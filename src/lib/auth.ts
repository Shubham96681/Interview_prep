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

// Test users data
export const testUsers = {
  candidate: {
    email: 'john@example.com',
    password: 'password123',
    name: 'John Doe',
    userType: 'candidate' as const,
    company: 'Tech Corp',
    title: 'Software Engineer',
    id: 'candidate-001',
    profile: {
      bio: 'Software engineer with 3 years of experience looking to improve interview skills',
      experience: '3 years in full-stack development',
      skills: ['JavaScript', 'React', 'Node.js', 'Python'],
      rating: 0,
      totalSessions: 0
    }
  },
  expert: {
    email: 'jane@example.com',
    password: 'password123',
    name: 'Jane Smith',
    userType: 'expert' as const,
    company: 'Google',
    title: 'Senior Software Engineer',
    id: 'expert-001',
    profile: {
      bio: 'Senior software engineer with 8 years of experience in tech interviews',
      experience: '8 years in software engineering, 5 years conducting interviews',
      skills: ['JavaScript', 'React', 'Node.js', 'Python', 'System Design', 'Algorithms'],
      rating: 4.8,
      totalSessions: 150,
      hourlyRate: 75,
      isVerified: true
    }
  }
};

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


