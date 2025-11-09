# Video Conferencing Integration Guide

This guide explains how to set up Zoom or Google Meet integration for interview sessions.

## Overview

The platform supports two video conferencing providers:
- **Zoom** (Recommended) - Full-featured with cloud recording
- **Google Meet** - Integrated with Google Calendar

## Zoom Integration

### Step 1: Create Zoom App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click "Develop" → "Build App"
4. Choose "Server-to-Server OAuth" app type
5. Fill in app details:
   - App Name: InterviewAce
   - Company Name: Your Company
   - Developer Contact: Your Email
6. Add scopes:
   - `meeting:write:admin`
   - `meeting:read:admin`
   - `recording:read:admin`
7. Activate your app

### Step 2: Get Credentials

After creating the app, you'll get:
- **Account ID** (found in app credentials)
- **Client ID** (API Key)
- **Client Secret** (API Secret)

### Step 3: Configure Environment Variables

Add these to your `server/.env` file:

```env
VIDEO_PROVIDER=zoom
ZOOM_API_KEY=your_client_id_here
ZOOM_API_SECRET=your_client_secret_here
ZOOM_ACCOUNT_ID=your_account_id_here
```

### Step 4: Configure Zoom Webhook (Optional - for automatic recording)

1. In your Zoom app settings, go to "Feature" → "Event Subscriptions"
2. Add event subscription:
   - Event notification endpoint URL: `https://your-domain.com/api/webhooks/zoom/recording`
   - Subscribe to: `recording.completed`
3. Verify the endpoint (Zoom will send a verification request)

## Google Meet Integration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google Calendar API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5000/oauth/google/callback` (for development)
   - `https://your-domain.com/oauth/google/callback` (for production)

### Step 2: Get OAuth Credentials

You'll receive:
- **Client ID**
- **Client Secret**

### Step 3: Get Refresh Token

1. Use OAuth 2.0 Playground: https://developers.google.com/oauthplayground/
2. Select "Google Calendar API v3"
3. Authorize and get refresh token

### Step 4: Configure Environment Variables

Add these to your `server/.env` file:

```env
VIDEO_PROVIDER=google_meet
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

## Features

### Automatic Meeting Creation
- When a session is scheduled, a Zoom or Google Meet meeting is automatically created
- Both candidate and expert receive the meeting link
- Meeting links appear in their dashboards

### Recording
- **Zoom**: Cloud recording is automatically enabled
- Recording URLs are automatically updated via webhook when recording completes
- Both participants can view recordings from their dashboards

### Meeting Access
- Participants can join via the "Join Meeting" button in their dashboard
- Meeting links open directly in Zoom or Google Meet
- No additional login required for participants

## Fallback Mode

If no video provider is configured, the system uses a fallback mode:
- Creates a simple meeting link pointing to `/meeting/{meetingId}`
- This allows the system to work without API credentials
- You can integrate a custom WebRTC solution later

## Testing

### Test Zoom Integration

1. Create a test session
2. Check server logs for "Creating Zoom meeting..."
3. Verify meeting link is a Zoom URL (zoom.us/j/...)
4. Click "Join Meeting" to verify it opens Zoom

### Test Google Meet Integration

1. Set `VIDEO_PROVIDER=google_meet` in `.env`
2. Create a test session
3. Check server logs for "Creating Google Meet meeting..."
4. Verify meeting link is a Google Meet URL
5. Click "Join Meeting" to verify it opens Google Meet

## Troubleshooting

### Zoom Issues

**Error: "Zoom credentials not configured"**
- Check that all three Zoom environment variables are set
- Verify credentials are correct in Zoom Marketplace

**Error: "Invalid access token"**
- Check that Account ID matches your Zoom account
- Verify API Key and Secret are correct
- Ensure app is activated in Zoom Marketplace

**Recording not appearing**
- Check webhook endpoint is configured correctly
- Verify webhook is receiving events in server logs
- Manually fetch recording using admin endpoint

### Google Meet Issues

**Error: "Google credentials not configured"**
- Check that all three Google environment variables are set
- Verify OAuth credentials are correct

**Error: "Invalid refresh token"**
- Regenerate refresh token using OAuth Playground
- Ensure Calendar API is enabled in Google Cloud Console

## Production Deployment

### On EC2:

1. Add environment variables to `server/.env`:
```bash
cd /var/www/interview-prep/server
nano .env
```

2. Add your video provider credentials

3. Restart the server:
```bash
pm2 restart interview-prep-backend
```

4. For Zoom webhooks, ensure your webhook URL is publicly accessible:
   - Use your EC2 public IP or domain
   - Example: `http://54.159.42.7/api/webhooks/zoom/recording`

## Security Notes

- Never commit API keys to version control
- Use environment variables for all credentials
- Rotate API keys regularly
- Verify webhook signatures in production (implement signature verification)

## API Endpoints

### Create Meeting (Automatic)
- Automatically called when session is created
- No manual API call needed

### Update Recording URL
- `PUT /api/sessions/:id/recording` (Admin only)
- Manually update recording URL if webhook fails

### Fetch Recording from Zoom
- `POST /api/sessions/:id/fetch-recording` (Admin only)
- Manually trigger recording fetch

### Zoom Webhook
- `POST /api/webhooks/zoom/recording`
- Automatically updates recording URLs when Zoom recording completes

