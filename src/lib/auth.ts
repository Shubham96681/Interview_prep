export interface User {
  email: string;
  name: string;
  userType: 'candidate' | 'expert' | 'admin';
  company?: string;
  title?: string;
  avatar?: string;
  id?: string;
  token?: string;
  // Backend user properties (from database)
  bio?: string;
  experience?: string;
  skills?: string[];
  rating?: number;
  totalSessions?: number;
  hourlyRate?: number;
  isVerified?: boolean;
  yearsOfExperience?: number;
  proficiency?: string;
  resumePath?: string;
  profilePhotoPath?: string;
  certificationPaths?: string;
  timezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  daysAvailable?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy profile object for backward compatibility
  profile?: {
    bio?: string;
    experience?: string;
    skills?: string[];
    rating?: number;
    totalSessions?: number;
    hourlyRate?: number;
    isVerified?: boolean;
  };
}

export const authService = {
  login: (userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
  },

  getCurrentUser: (): User | null => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },

  isAuthenticated: (): boolean => {
    return localStorage.getItem('isAuthenticated') === 'true';
  },

  // Test login function
  testLogin: (email: string, password: string): User | null => {
    if (email === testUsers.candidate.email && password === testUsers.candidate.password) {
      return testUsers.candidate;
    }
    if (email === testUsers.expert.email && password === testUsers.expert.password) {
      return testUsers.expert;
    }
    return null;
  }
};


