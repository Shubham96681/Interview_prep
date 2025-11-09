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
      const token = localStorage.getItem('token');
      if (token) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Authorization': `Bearer ${token}`,
        };
      }

      console.log('Making request to:', url, 'with options:', requestOptions);

      const response = await this.retryRequest(() => fetch(url, requestOptions));

      console.log('Response status:', response.status, 'Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Error response data:', errorData);
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
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
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: userData,
      headers: {}, // Don't set Content-Type for FormData
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
