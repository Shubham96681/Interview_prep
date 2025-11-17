// API Service with retry logic and error handling

// Use relative URL for production (works with Nginx proxy)
// Fallback to localhost for local development
const getApiBaseUrl = (): string => {
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
      const url = `${API_BASE_URL}${endpoint}`;
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

  async checkEmail(email: string): Promise<ApiResponse<{ exists: boolean; message: string }>> {
    return this.request(`/api/auth/check-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
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

  async createReview(sessionId: string, rating: number, comment: string, categories?: string) {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ sessionId, rating, comment, categories }),
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

      console.log('📤 Uploading recording for session:', sessionId, 'Size:', recordingBlob.size, 'bytes');

      // Don't set Content-Type - browser will set it automatically with boundary for FormData
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

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
      console.log('Recording uploaded successfully:', data);
      return {
        success: true,
        data: data.data || data,
      };
    } catch (error: any) {
      console.error('Failed to upload recording:', error);
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
}

// Create singleton instance
export const apiService = new ApiService();

// Export types
export type { ApiResponse };
