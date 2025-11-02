// API Service with retry logic and error handling
import backendDetector from './backendDetector';

let API_BASE_URL = 'http://localhost:5000'; // Default fallback
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Initialize backend detection
backendDetector.detectBackendPort().then(port => {
  API_BASE_URL = `http://localhost:${port}`;
  console.log(`🌐 API Service configured for: ${API_BASE_URL}`);
}).catch(error => {
  console.warn('⚠️ Backend detection failed, using default port:', error);
});

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private isBackendAvailable: boolean | null = null;
  private healthCheckPromise: Promise<boolean> | null = null;

  // Check if backend is available
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
      
      const response = await fetch(`${API_BASE_URL}/api/health`, {
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
  private async retryRequest<T>(
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

  async getSessions(limit: number = 100) {
    return this.request(`/api/sessions?limit=${limit}`);
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
}

// Create singleton instance
export const apiService = new ApiService();

// Export types
export type { ApiResponse };
