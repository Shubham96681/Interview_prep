// API Service with retry logic and error handling

// Use relative URL for production (works with Nginx proxy)
// Fallback to localhost for local development
const getApiBaseUrl = (): string => {
  // Check for explicit API URL in environment variables first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production, use relative path (Nginx will proxy /api to backend)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return ''; // Empty string means relative URLs like '/api'
  }
  // In development, try to detect backend port
  return 'http://localhost:5000';
};

let API_BASE_URL = getApiBaseUrl();
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

console.log(`🌐 API Service configured for: ${API_BASE_URL || 'relative URLs (production mode)'}`);
console.log(`🌐 Current hostname: ${window.location.hostname}`);
console.log(`🌐 VITE_API_URL env: ${import.meta.env.VITE_API_URL || 'not set'}`);

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

class ApiService {
  private isBackendAvailable: boolean | null = null;
  private healthCheckPromise: Promise<boolean> | null = null;

  // Check if backend is available (currently unused but kept for future use)
  // @ts-ignore - Method kept for potential future use
  private async checkBackendHealth(): Promise<boolean> {
    if (this.healthCheckPromise) {
      return this.healthCheckPromise;
    }

    this.healthCheckPromise = this.performHealthCheck();
    return this.healthCheckPromise;
  }

  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const url = API_BASE_URL ? `${API_BASE_URL}/api/health` : '/api/health';
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isBackendAvailable = response.ok;
      return response.ok;
    } catch (error) {
      console.warn('Backend health check failed:', error);
      this.isBackendAvailable = false;
      return false;
    } finally {
      // Reset health check promise after 30 seconds
      setTimeout(() => {
        this.healthCheckPromise = null;
      }, 30000);
    }
  }

  // Retry mechanism with exponential backoff
  private async retryRequest(
    requestFn: () => Promise<Response>,
    retries: number = MAX_RETRIES
  ): Promise<Response> {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      if (retries > 0 && this.isConnectionError(error)) {
        console.warn(`Request failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
        await this.delay(RETRY_DELAY * (MAX_RETRIES - retries + 1));
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  private isConnectionError(error: any): boolean {
    return (
      error.name === 'TypeError' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('ERR_CONNECTION_REFUSED') ||
      error.message?.includes('ERR_NETWORK') ||
      error.code === 'ECONNREFUSED'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generic request method
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Ensure endpoint starts with /
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = API_BASE_URL ? `${API_BASE_URL}${normalizedEndpoint}` : normalizedEndpoint;
      const requestOptions: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      // Add authorization header if token exists
      let token: string | null = localStorage.getItem('token');
      
      // Fallback: Check if token is stored in user object
      if (!token) {
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.token && typeof user.token === 'string') {
              token = user.token;
              // Also save it separately for future use (token is guaranteed to be string here)
              localStorage.setItem('token', token as string);
              console.log('🔑 Token found in user object, saved to localStorage');
            }
          }
        } catch (e) {
          console.error('Error parsing user object:', e);
        }
      }
      
      if (token) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Authorization': `Bearer ${token}`,
        };
        console.log('🔑 Token found, adding to headers:', token.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ No token found in localStorage or user object!');
      }

      console.log('Making request to:', url, 'with options:', {
        method: requestOptions.method,
        headers: requestOptions.headers,
        body: requestOptions.body ? (typeof requestOptions.body === 'string' ? requestOptions.body.substring(0, 100) + '...' : '[FormData]') : undefined
      });

      const response = await this.retryRequest(() => fetch(url, requestOptions));

      console.log('Response status:', response.status, 'Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Error response data:', errorData);
        
        // Handle rate limiting (429) specifically
        if (response.status === 429) {
          return {
            success: false,
            error: errorData.message || errorData.error || 'Too many requests. Please wait a moment before trying again.',
            message: errorData.message || 'Too many requests. Please wait a moment before trying again.',
            status: 429,
            data: errorData
          };
        }
        
        // Handle authentication errors (401) - token may be invalid or expired
        if (response.status === 401) {
          // Check if it's a test token
          const token = localStorage.getItem('token');
          if (token && token.startsWith('test-token-')) {
            console.warn('⚠️ Test token detected in production. Test tokens are only valid in development.');
            console.warn('💡 Please log in with a real account or use the development environment.');
          }
          return {
            success: false,
            error: errorData.error || errorData.message || 'Authentication failed. Please log in again.',
            message: errorData.message || 'Authentication failed. Please log in again.',
            status: 401,
            data: errorData
          };
        }
        
        return {
          success: false,
          error: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          message: errorData.message,
          status: response.status,
          data: errorData
        };
      }

      const data = await response.json();
      console.log('Success response data:', data);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  private getErrorMessage(error: any): string {
    if (this.isConnectionError(error)) {
      return 'Unable to connect to the server. Please ensure the backend server is running on port 5001.';
    }
    return error.message || 'An unexpected error occurred';
  }

  // Specific API methods
  async login(email: string, password: string) {
    console.log('API Service: Attempting login for:', email);
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: FormData) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: userData,
      headers: {}, // Don't set Content-Type for FormData
    });
  }

  async verifyOTP(email: string, otp: string) {
    return this.request('/api/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });
  }

  async resendOTP(email: string) {
    return this.request('/api/auth/resend-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
  }

  async checkEmail(email: string): Promise<ApiResponse<{ exists: boolean; message: string }>> {
    return this.request(`/api/auth/check-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getSessions(limit: number = 100, userId?: string, userType?: string) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (userId) params.append('userId', userId);
    if (userType) params.append('userType', userType);
    return this.request(`/api/sessions?${params.toString()}`);
  }

  async getSessionByMeetingId(meetingId: string) {
    return this.request(`/api/sessions/meeting/${meetingId}`);
  }

  async getSessionById(sessionId: string) {
    return this.request(`/api/sessions/${sessionId}`);
  }

  async getSessionReviews(sessionId: string) {
    return this.request(`/api/sessions/${sessionId}/reviews`);
  }

  async createReview(sessionId: string, rating: number, comment: string, categories?: string, userId?: string) {
    // Get current user ID as fallback for test tokens
    // Try multiple sources: provided userId, AuthContext user, localStorage user
    let finalUserId: string | undefined = userId;
    
    if (!finalUserId) {
      try {
        // First try: AuthContext user (most reliable)
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user && user.id) {
            // Include all IDs - backend will map test IDs to database IDs
            finalUserId = user.id;
            console.log('✅ Using userId from localStorage user:', finalUserId);
          }
        }
      } catch (e) {
        console.error('Error getting user ID for review:', e);
      }
    }

    console.log('📝 Creating review with userId:', finalUserId || 'NOT PROVIDED');
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ sessionId, rating, comment, categories, userId: finalUserId }),
    });
  }

  async updateSessionStatus(sessionId: string, status: string) {
    return this.request(`/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async createSession(sessionData: {
    expertId: string;
    candidateId: string;
    date: string;
    time: string;
    duration?: number;
    sessionType?: string;
  }) {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getExpert(id: string) {
    return this.request(`/api/experts/${id}`);
  }

  async getExperts() {
    return this.request('/api/experts');
  }

  async getExpertBookedSlots(expertId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return this.request(`/api/experts/${expertId}/booked-slots${queryString ? `?${queryString}` : ''}`);
  }

  async updateProfile(userData: FormData) {
    // Get token for authentication
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData - browser will set it with boundary
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: userData,
      headers
    });
  }

  // Health check method
  async healthCheck() {
    return this.request('/api/health');
  }

  // Get backend availability status
  getBackendStatus(): boolean | null {
    return this.isBackendAvailable;
  }

  // Admin API methods
  async getAllSessions() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions?email=${encodeURIComponent(user.email || '')}`);
  }

  async updateSession(sessionId: string, sessionData: any) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions/${sessionId}?email=${encodeURIComponent(user.email || '')}`, {
      method: 'PUT',
      body: JSON.stringify(sessionData),
    });
  }

  async deleteSession(sessionId: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions/${sessionId}?email=${encodeURIComponent(user.email || '')}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get a fresh signed URL for a session recording
   * This automatically handles expired tokens by generating a new signed URL
   */
  async getRecordingUrl(sessionId: string): Promise<string | null> {
    try {
      const response = await this.request(`/api/sessions/${sessionId}/recording`, {
        method: 'GET'
      });
      
      console.log('📥 getRecordingUrl response:', response);
      
      // Check for access denied or authentication errors
      if (response.status === 403 || response.status === 401) {
        console.warn('⚠️ Access denied or authentication error:', response.message || response.error);
        // Return null to allow fallback URL usage
        return null;
      }
      
      // The apiService.request wraps the response
      // Server returns: { success: true, data: { recordingUrl: "...", sessionId: "..." } }
      // apiService.request wraps it: { success: true, data: { success: true, data: { recordingUrl: "...", sessionId: "..." } } }
      if (response.success && response.data) {
        // Check if it's the wrapped structure (nested data.data)
        const nestedData = (response.data as any)?.data;
        if (nestedData && nestedData.recordingUrl) {
          console.log('✅ Found recordingUrl in nested structure');
          return nestedData.recordingUrl;
        }
        // Or direct structure (response.data.recordingUrl)
        const directData = response.data as any;
        if (directData.recordingUrl) {
          console.log('✅ Found recordingUrl in direct structure');
          return directData.recordingUrl;
        }
      }
      
      console.error('❌ Could not find recordingUrl in response:', response);
      return null;
    } catch (error) {
      console.error('Error getting recording URL:', error);
      return null;
    }
  }

  /**
   * Open a recording URL with automatic regeneration if expired
   * This function ALWAYS fetches a fresh URL from the backend, which automatically
   * generates a new signed URL even if the original URL in the database is expired.
   */
  async openRecordingUrl(sessionId: string, fallbackUrl?: string): Promise<void> {
    try {
      console.log(`🔄 Getting fresh recording URL for session: ${sessionId}`);
      console.log(`📋 Fallback URL (if any): ${fallbackUrl ? fallbackUrl.substring(0, 100) + '...' : 'none'}`);
      
      // ALWAYS try to get a fresh signed URL from the backend first
      // The backend will extract the S3 key from the stored URL (even if expired)
      // and generate a brand new signed URL that's valid for 7 days
      const freshUrl = await this.getRecordingUrl(sessionId);
      
      if (freshUrl) {
        console.log(`✅ Got fresh URL from backend (automatically regenerated, valid for 7 days)`);
        console.log(`🔗 Fresh URL: ${freshUrl.substring(0, 100)}...`);
        
        // Open custom video player page with the sessionId (avoids URL length limits)
        const playerUrl = `${window.location.origin}/video-player?sessionId=${sessionId}`;
        const newWindow = window.open(playerUrl, '_blank');
        
        // If opening failed, try again after a short delay
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          console.warn('⚠️ Popup blocked or failed, retrying...');
          // Retry once after a short delay
          setTimeout(() => {
            window.open(playerUrl, '_blank');
          }, 500);
        }
        return;
      }
      
      // Backend failed to generate fresh URL - this should rarely happen
      // Only use fallback if backend completely fails
      console.warn('⚠️ Backend failed to generate fresh URL, trying fallback URL as last resort');
        
        if (fallbackUrl) {
        console.log('⚠️ Using fallback URL (may be expired):', fallbackUrl.substring(0, 100));
          
        // Open custom video player page with the sessionId (avoids URL length limits)
        const playerUrl = `${window.location.origin}/video-player?sessionId=${sessionId}`;
        const newWindow = window.open(playerUrl, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          console.warn('⚠️ Popup blocked, retrying...');
          setTimeout(() => {
            window.open(playerUrl, '_blank');
          }, 500);
          }
          
        // If it's an S3 URL, it might be expired
        if (fallbackUrl.includes('amazonaws.com')) {
          console.warn('⚠️ Using fallback S3 URL - it may be expired. The browser will show an error if so.');
        }
        
        return;
      }
      
      // No URL available at all
      throw new Error('No recording URL available. Please contact support if this issue persists.');
    } catch (error: any) {
      console.error('❌ Error opening recording URL:', error);
      
      // If it's our custom error, throw it
      if (error.message && error.message.includes('No recording URL available')) {
      throw error;
      }
      
      // For other errors, try the fallback URL if available (last resort)
      if (fallbackUrl) {
        console.warn('⚠️ Error occurred, trying fallback URL as absolute last resort');
        window.open(fallbackUrl, '_blank');
        return;
      }
      
      // Re-throw if no fallback available
      throw new Error('Failed to open recording. Please try again or contact support.');
    }
  }

  async uploadRecording(sessionId: string, recordingBlob: Blob): Promise<ApiResponse<{ recordingUrl: string; fileSize: number; filename: string }>> {
    try {
      const url = `${API_BASE_URL}/api/sessions/${sessionId}/upload-recording`;
      const formData = new FormData();
      formData.append('recording', recordingBlob, `recording-${sessionId}-${Date.now()}.webm`);

      // Get token from localStorage (same as request method)
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Token found for upload:', token.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ No token found in localStorage for upload');
        // Try to get from user object as fallback
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user.token) {
              headers['Authorization'] = `Bearer ${user.token}`;
              console.log('🔑 Using token from user object');
            }
          } catch (e) {
            console.error('Error parsing user object:', e);
          }
        }
      }

      const fileSizeMB = (recordingBlob.size / (1024 * 1024)).toFixed(2);
      console.log('📤 Uploading recording for session:', sessionId, 'Size:', recordingBlob.size, 'bytes', `(${fileSizeMB} MB)`);

      // Create AbortController for timeout (60 minutes for 60+ minute recordings)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60 * 60 * 1000); // 60 minutes

      try {
      // Don't set Content-Type - browser will set it automatically with boundary for FormData
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
          signal: controller.signal, // Add abort signal for timeout
      });
        
        clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          message: errorData.message,
          status: response.status,
        };
      }

      const data = await response.json();
        console.log('✅ Recording uploaded successfully:', data);
      return {
        success: true,
        data: data.data || data,
      };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Check if it's a timeout/abort error
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          console.error('❌ Upload timeout - file may be too large or connection is slow');
          return {
            success: false,
            error: 'Upload timeout. The recording file may be too large or your connection is slow. Please try again or contact support.',
          };
        }
        
        console.error('❌ Failed to upload recording:', fetchError);
        return {
          success: false,
          error: fetchError.message || 'Failed to upload recording',
        };
      }
    } catch (error: any) {
      console.error('❌ Error in uploadRecording:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload recording',
      };
    }
  }

  async getAllUsers() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/users?email=${encodeURIComponent(user.email || '')}`);
  }

  async updateUser(userId: string, userData: any) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/users/${userId}?email=${encodeURIComponent(user.email || '')}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async getAllReviews() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/reviews?email=${encodeURIComponent(user.email || '')}`);
  }

  async addSessionParticipants(sessionId: string, participantIds: string[]) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions/${sessionId}/participants?email=${encodeURIComponent(user.email || '')}`, {
      method: 'PUT',
      body: JSON.stringify({ participantIds }),
    });
  }

  async getExpertAnalytics(expertId: string, timeRange: string = '3months') {
    return this.request<{ totalEarnings: number; totalSessions: number; averageRating: number; completionRate: number; monthlyEarnings: any[]; sessionTypes: any[]; weeklyStats: any[]; topClients: any[]; timeTracking: any; candidateTimeTracking: any[] }>(
      `/api/analytics/expert/${expertId}?timeRange=${timeRange}`,
      { method: 'GET' }
    );
  }

  async getAvailabilitySlots(expertId: string) {
    return this.request<{ daysAvailable: string[]; workingHoursStart: string; workingHoursEnd: string; timezone: string }>(
      `/api/experts/${expertId}/availability-slots`,
      { method: 'GET' }
    );
  }

  async updateAvailability(expertId: string, data: { daysAvailable?: string[]; workingHoursStart?: string; workingHoursEnd?: string; timezone?: string }) {
    return this.request(
      `/api/experts/${expertId}/availability`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    );
  }

  async getAnalytics(period: string = 'month') {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/analytics?email=${encodeURIComponent(user.email || '')}&period=${period}`);
  }

  async rescheduleSession(sessionId: string, date: string, time: string, reason?: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions/${sessionId}/reschedule?email=${encodeURIComponent(user.email || '')}`, {
      method: 'POST',
      body: JSON.stringify({ date, time, reason }),
    });
  }

  async cancelSession(sessionId: string, reason?: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/sessions/${sessionId}/cancel?email=${encodeURIComponent(user.email || '')}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getUserDetails(userId: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/users/${userId}?email=${encodeURIComponent(user.email || '')}`);
  }

  async createUser(userData: any) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/users?email=${encodeURIComponent(user.email || '')}`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async approveExpert(userId: string, approved: boolean, reason?: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/users/${userId}/approve-expert?email=${encodeURIComponent(user.email || '')}`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    });
  }

  async getTransactions() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/financial/transactions?email=${encodeURIComponent(user.email || '')}`);
  }

  async getPayouts() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/financial/payouts?email=${encodeURIComponent(user.email || '')}`);
  }

  // Monitoring endpoints
  async getMonitoring(timeRange: string = '1h') {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/monitoring?email=${encodeURIComponent(user.email || '')}&timeRange=${timeRange}`);
  }

  async getMonitoringErrors(limit: number = 100) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/monitoring/errors?email=${encodeURIComponent(user.email || '')}&limit=${limit}`);
  }

  async getMonitoringActivity(limit: number = 100) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.request(`/api/admin/monitoring/activity?email=${encodeURIComponent(user.email || '')}&limit=${limit}`);
  }

  async recordVideoMetrics(quality: string, bitrate: number, bufferingTime: number) {
    return this.request('/api/admin/monitoring/video', {
      method: 'POST',
      body: JSON.stringify({ quality, bitrate, bufferingTime }),
    });
  }

  async recordCdnRequest(hit: boolean) {
    return this.request('/api/admin/monitoring/cdn', {
      method: 'POST',
      body: JSON.stringify({ hit }),
    });
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Export types
export type { ApiResponse };
