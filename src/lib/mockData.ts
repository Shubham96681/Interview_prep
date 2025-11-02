export interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  experience: string;
  languages: string[];
  specialties: string[];
  availability: string[];
}

export interface Session {
  id: string;
  title?: string;
  description?: string;
  scheduledDate?: string;
  date?: string;
  time?: string;
  duration: number;
  sessionType: 'mock' | 'technical' | 'behavioral' | 'system_design' | 'resume';
  status: 'upcoming' | 'completed' | 'cancelled' | 'scheduled' | 'in_progress';
  createdAt: string;
  updatedAt?: string;
  candidateId: string;
  expertId: string;
  candidateName?: string;
  expertName?: string;
  paymentAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  feedbackRating?: number;
  feedbackComment?: string;
  meetingLink?: string;
  // Legacy fields for backward compatibility
  type?: string;
  date?: string;
  time?: string;
  rating?: number;
  feedback?: string;
}

export const mockExperts: Expert[] = [
  {
    id: 'expert-001',
    name: 'Jane Smith',
    title: 'Senior Software Engineer',
    company: 'Google',
    bio: 'Senior software engineer with 8 years of experience in tech interviews. Expert in JavaScript, React, Node.js, Python, System Design, and Algorithms. I\'ve conducted 150+ interviews and helped candidates land jobs at top tech companies.',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    rating: 4.8,
    reviewCount: 150,
    hourlyRate: 75,
    experience: '8+ years',
    languages: ['English'],
    specialties: ['JavaScript', 'React', 'Node.js', 'Python', 'System Design', 'Algorithms'],
    availability: ['Mon-Fri 9AM-5PM UTC', 'Weekends 10AM-4PM UTC']
  }
];

// Import session service to get sessions
import { sessionService } from './sessionService';

// Export sessions from service
export const mockSessions = sessionService.getAllSessions();


