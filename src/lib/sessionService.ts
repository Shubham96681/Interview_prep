import { Session } from './mockData';

// In-memory session storage (in a real app, this would be an API)
const sessions: Session[] = [
  {
    id: 'session-001',
    title: 'Mock Technical Interview',
    description: 'Technical interview preparation session',
    scheduledDate: '2024-01-15T14:00:00Z',
    duration: 60,
    sessionType: 'technical',
    status: 'completed',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-15T15:00:00Z',
    candidateId: 'candidate-001',
    expertId: 'expert-001',
    paymentAmount: 75,
    paymentStatus: 'completed',
    paymentMethod: 'credit_card',
    feedbackRating: 5,
    feedbackComment: 'Excellent performance! Great problem-solving skills and clear communication. Areas for improvement: system design depth.',
    // Legacy fields for backward compatibility
    type: 'Mock Technical Interview',
    date: '2024-01-15',
    time: '14:00',
    rating: 5,
    feedback: 'Excellent performance! Great problem-solving skills and clear communication. Areas for improvement: system design depth.'
  },
  {
    id: 'session-002',
    title: 'Resume Review Session',
    description: 'Professional resume review and optimization',
    scheduledDate: '2024-10-20T10:00:00Z',
    duration: 30,
    sessionType: 'behavioral',
    status: 'upcoming',
    createdAt: '2024-10-15T10:00:00Z',
    updatedAt: '2024-10-15T10:00:00Z',
    candidateId: 'candidate-001',
    expertId: 'expert-001',
    paymentAmount: 50,
    paymentStatus: 'pending',
    paymentMethod: 'credit_card',
    // Legacy fields for backward compatibility
    type: 'Resume Review Session',
    date: '2024-10-20',
    time: '10:00'
  },
  {
    id: 'session-003',
    title: 'System Design Practice',
    description: 'System design interview preparation',
    scheduledDate: '2024-01-10T15:30:00Z',
    duration: 90,
    sessionType: 'technical',
    status: 'completed',
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-10T17:00:00Z',
    candidateId: 'candidate-001',
    expertId: 'expert-001',
    paymentAmount: 100,
    paymentStatus: 'completed',
    paymentMethod: 'credit_card',
    feedbackRating: 4,
    feedbackComment: 'Good system design thinking. Consider preparing more specific metrics and scalability considerations.',
    // Legacy fields for backward compatibility
    type: 'System Design Practice',
    date: '2024-01-10',
    time: '15:30',
    rating: 4,
    feedback: 'Good system design thinking. Consider preparing more specific metrics and scalability considerations.'
  }
];

export const sessionService = {
  // Get all sessions
  getAllSessions: (): Session[] => {
    return sessions;
  },

  // Get sessions for a specific user
  getUserSessions: (userId: string, userType: 'candidate' | 'expert'): Session[] => {
    return sessions.filter(session => 
      userType === 'candidate' 
        ? session.candidateId === userId 
        : session.expertId === userId
    );
  },

  // Add a new session
  addSession: (session: Omit<Session, 'id'>): Session => {
    const newSession: Session = {
      ...session,
      id: `session-${Date.now()}` // Simple ID generation
    };
    sessions.push(newSession);
    return newSession;
  },

  // Update session status
  updateSessionStatus: (sessionId: string, status: Session['status']): Session | null => {
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].status = status;
      return sessions[sessionIndex];
    }
    return null;
  },

  // Get session by ID
  getSessionById: (sessionId: string): Session | null => {
    return sessions.find(s => s.id === sessionId) || null;
  },

  // Get upcoming sessions for a user
  getUpcomingSessions: (userId: string, userType: 'candidate' | 'expert'): Session[] => {
    const userSessions = sessionService.getUserSessions(userId, userType);
    return userSessions.filter(session => session.status === 'upcoming');
  },

  // Get completed sessions for a user
  getCompletedSessions: (userId: string, userType: 'candidate' | 'expert'): Session[] => {
    const userSessions = sessionService.getUserSessions(userId, userType);
    return userSessions.filter(session => session.status === 'completed');
  }
};
