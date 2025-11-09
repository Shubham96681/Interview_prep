const axios = require('axios');
require('dotenv').config();

class VideoService {
  constructor() {
    this.provider = process.env.VIDEO_PROVIDER || 'webrtc'; // 'zoom', 'google_meet', or 'webrtc'
    this.zoomApiKey = process.env.ZOOM_API_KEY;
    this.zoomApiSecret = process.env.ZOOM_API_SECRET;
    this.zoomAccountId = process.env.ZOOM_ACCOUNT_ID; // For Server-to-Server OAuth
    this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  }

  /**
   * Generate Zoom access token using Server-to-Server OAuth
   */
  async getZoomAccessToken() {
    try {
      if (!this.zoomAccountId || !this.zoomApiKey || !this.zoomApiSecret) {
        throw new Error('Zoom credentials not configured');
      }

      const token = Buffer.from(`${this.zoomApiKey}:${this.zoomApiSecret}`).toString('base64');
      
      const response = await axios.post(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.zoomAccountId}`,
        {},
        {
          headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting Zoom access token:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a Zoom meeting
   */
  async createZoomMeeting(sessionData) {
    try {
      const accessToken = await this.getZoomAccessToken();
      
      if (!accessToken) {
        throw new Error('Failed to get Zoom access token');
      }
      
      const meetingData = {
        topic: sessionData.title || 'Interview Session',
        type: 2, // Scheduled meeting
        start_time: new Date(sessionData.scheduledDate).toISOString(),
        duration: sessionData.duration || 60,
        timezone: 'UTC',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          watermark: false,
          use_pmi: false,
          approval_type: 0, // Automatically approve
          audio: 'both',
          auto_recording: 'cloud', // Enable cloud recording
          waiting_room: false
        }
      };

      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        meetingId: response.data.id.toString(),
        meetingLink: response.data.join_url,
        startUrl: response.data.start_url,
        password: response.data.password,
        recordingUrl: null // Will be updated via webhook
      };
    } catch (error) {
      console.error('Error creating Zoom meeting:', error.response?.data || error.message);
      // Fallback to simple meeting link if Zoom fails
      return this.createFallbackMeeting(sessionData);
    }
  }

  /**
   * Create a Google Meet link via Google Calendar API
   */
  async createGoogleMeetMeeting(sessionData) {
    try {
      if (!this.googleClientId || !this.googleClientSecret || !this.googleRefreshToken) {
        throw new Error('Google credentials not configured');
      }

      // Get access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        refresh_token: this.googleRefreshToken,
        grant_type: 'refresh_token'
      });

      const accessToken = tokenResponse.data.access_token;

      // Create calendar event with Google Meet
      const eventData = {
        summary: sessionData.title || 'Interview Session',
        description: sessionData.description || 'Interview session',
        start: {
          dateTime: new Date(sessionData.scheduledDate).toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(new Date(sessionData.scheduledDate).getTime() + (sessionData.duration || 60) * 60000).toISOString(),
          timeZone: 'UTC'
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };

      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        eventData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        meetingId: response.data.id,
        meetingLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri,
        startUrl: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri,
        password: null,
        recordingUrl: null // Google Meet recordings are stored in Google Drive
      };
    } catch (error) {
      console.error('Error creating Google Meet meeting:', error.response?.data || error.message);
      // Fallback to simple meeting link if Google Meet fails
      return this.createFallbackMeeting(sessionData);
    }
  }

  /**
   * Fallback: Create a simple meeting link (for when APIs are not configured)
   */
  createFallbackMeeting(sessionData) {
    const meetingId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    return {
      meetingId: meetingId,
      meetingLink: `${baseUrl}/meeting/${meetingId}`,
      startUrl: `${baseUrl}/meeting/${meetingId}`,
      password: null,
      recordingUrl: null
    };
  }

  /**
   * Create a WebRTC meeting (custom video system)
   */
  createWebRTCMeeting(sessionData) {
    const meetingId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    // Use relative URL so it works with any domain/IP
    // The frontend will handle the full URL construction
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // If FRONTEND_URL is set, use it; otherwise use relative path
    // This ensures meeting links work even if the IP changes
    const meetingLink = baseUrl.includes('localhost') 
      ? `${baseUrl}/meeting/${meetingId}`
      : `/meeting/${meetingId}`;
    
    return {
      meetingId: meetingId,
      meetingLink: meetingLink,
      startUrl: meetingLink,
      password: null,
      recordingUrl: null
    };
  }

  /**
   * Create a meeting based on configured provider
   */
  async createMeeting(sessionData) {
    try {
      if (this.provider === 'webrtc') {
        console.log('Creating WebRTC meeting (custom video system)...');
        return this.createWebRTCMeeting(sessionData);
      } else if (this.provider === 'zoom' && this.zoomApiKey && this.zoomApiSecret) {
        console.log('Creating Zoom meeting...');
        return await this.createZoomMeeting(sessionData);
      } else if (this.provider === 'google_meet' && this.googleClientId && this.googleClientSecret) {
        console.log('Creating Google Meet meeting...');
        return await this.createGoogleMeetMeeting(sessionData);
      } else {
        console.log('No video provider configured, using WebRTC (custom) meeting...');
        return this.createWebRTCMeeting(sessionData);
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      // Always fallback to WebRTC meeting
      return this.createWebRTCMeeting(sessionData);
    }
  }

  /**
   * Get recording URL from Zoom (called via webhook)
   */
  async getZoomRecording(meetingId) {
    try {
      const accessToken = await this.getZoomAccessToken();
      
      const response = await axios.get(
        `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.data.recording_files && response.data.recording_files.length > 0) {
        // Return the first recording file URL
        return response.data.recording_files[0].play_url || response.data.recording_files[0].download_url;
      }

      return null;
    } catch (error) {
      console.error('Error getting Zoom recording:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = new VideoService();

