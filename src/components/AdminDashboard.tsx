import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiService } from '@/lib/apiService';
import { toast } from 'sonner';
import { Trash2, Edit, Plus, Users, Calendar, Star, CalendarDays, Download, TrendingUp, DollarSign, Clock, Activity, ChevronLeft, ChevronRight, Video, Monitor, AlertTriangle, Wifi, Zap, BarChart3, Server, MessageSquare } from 'lucide-react';
import AdminCalendarView from './AdminCalendarView';
import AddUserForm from './AddUserForm';

interface Session {
  id: string;
  expertId: string;
  candidateId: string;
  expertName: string;
  candidateName: string;
  date: string;
  time: string;
  scheduledDate: string;
  duration: number;
  sessionType: string;
  status: string;
  paymentAmount?: number;
  paymentStatus?: string;
  feedbackRating?: number;
  feedbackComment?: string;
  additionalParticipants?: string[];
  reviews?: any[];
  recordingUrl?: string;
  isRecordingEnabled?: boolean;
  meetingId?: string;
  meetingLink?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  userType: string;
  isActive: boolean;
  rating?: number;
  totalSessions?: number;
  hourlyRate?: number;
  isVerified?: boolean;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  session: {
    id: string;
    title: string;
    candidate: { name: string; email: string };
    expert: { name: string; email: string };
  };
  reviewer: { name: string; email: string };
  reviewee: { name: string; email: string };
}

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalReviews: number;
  averageRating: number;
  sessionsByStatus: Record<string, number>;
  usersByType: Record<string, number>;
  totalRevenue?: number;
  completedRevenue?: number;
  newSignups?: {
    candidates: number;
    experts: number;
    total: number;
  };
  periodInterviews?: number;
  platformUtilizationRate?: number;
  sessionsOverTime?: Array<{ date: string; count: number }>;
  revenueOverTime?: Array<{ date: string; amount: number }>;
  popularExpertiseAreas?: Array<{ type: string; count: number }>;
  averageExpertRating?: number;
  systemHealth?: {
    apiLatency: number;
    serverUptime: number;
    videoIntegrationStatus: string;
  };
}

interface AdminDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
  };
}

export default function AdminDashboard({}: AdminDashboardProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addParticipantsOpen, setAddParticipantsOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [userFilters, setUserFilters] = useState({ type: 'all', status: 'all', search: '' });
  const [sessionFilters, setSessionFilters] = useState({ status: 'all', expert: 'all', candidate: 'all' });
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [monitoringTimeRange, setMonitoringTimeRange] = useState<'5m' | '15m' | '1h' | '24h'>('1h');
  const [monitoringErrors, setMonitoringErrors] = useState<any[]>([]);
  const [monitoringActivity, setMonitoringActivity] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, usersRes, reviewsRes, analyticsRes, transactionsRes, payoutsRes] = await Promise.all([
        apiService.getAllSessions(),
        apiService.getAllUsers(),
        apiService.getAllReviews(),
        apiService.getAnalytics(analyticsPeriod),
        apiService.getTransactions(),
        apiService.getPayouts()
      ]);

      if (sessionsRes.success) {
        setSessions(sessionsRes.data?.sessions || []);
      }
      if (usersRes.success) {
        setUsers(usersRes.data?.users || []);
      }
      if (reviewsRes.success) {
        setReviews(reviewsRes.data?.reviews || []);
      }
      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data?.analytics || null);
      }
      if (transactionsRes.success) {
        setTransactions(transactionsRes.data?.transactions || []);
        setFinancialSummary(transactionsRes.data?.summary || null);
      }
      if (payoutsRes.success) {
        setPayouts(payoutsRes.data?.payouts || []);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadMonitoring();
  }, [analyticsPeriod]);

  useEffect(() => {
    loadMonitoring();
    const interval = setInterval(() => {
      loadMonitoring();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [monitoringTimeRange]);

  const loadMonitoring = async () => {
    try {
      const [monitoringRes, errorsRes, activityRes] = await Promise.all([
        apiService.getMonitoring(monitoringTimeRange),
        apiService.getMonitoringErrors(50),
        apiService.getMonitoringActivity(50)
      ]);

      if (monitoringRes.success) {
        setMonitoring(monitoringRes.data);
      }
      if (errorsRes.success) {
        setMonitoringErrors(errorsRes.data?.errors || []);
      }
      if (activityRes.success) {
        setMonitoringActivity(activityRes.data?.activities || []);
      }
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    }
  };

  const handleUpdateSession = async (sessionId: string, data: any) => {
    try {
      const response = await apiService.updateSession(sessionId, data);
      if (response.success) {
        toast.success('Session updated successfully');
        setEditSessionOpen(false);
        loadData();
      } else {
        throw new Error(response.error || 'Failed to update session');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const response = await apiService.deleteSession(sessionId);
      if (response.success) {
        toast.success('Session deleted successfully');
        loadData();
      } else {
        throw new Error(response.error || 'Failed to delete session');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete session');
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      const response = await apiService.updateUser(userId, data);
      if (response.success) {
        toast.success('User updated successfully');
        setEditUserOpen(false);
        loadData();
      } else {
        throw new Error(response.error || 'Failed to update user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const handleAddParticipants = async () => {
    if (!selectedSession || selectedParticipants.length === 0) return;

    try {
      const response = await apiService.addSessionParticipants(selectedSession.id, selectedParticipants);
      if (response.success) {
        toast.success('Participants added successfully');
        setAddParticipantsOpen(false);
        setSelectedParticipants([]);
        loadData();
      } else {
        throw new Error(response.error || 'Failed to add participants');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add participants');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const exportData = (type: 'sessions' | 'users' | 'payments' | 'recordings') => {
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'sessions':
        data = sessions.map(s => ({
          id: s.id,
          candidate: s.candidateName,
          expert: s.expertName,
          date: s.date,
          time: s.time,
          type: s.sessionType,
          status: s.status,
          payment: s.paymentAmount,
          paymentStatus: s.paymentStatus
        }));
        filename = 'sessions-export.csv';
        break;
      case 'users':
        data = users.map(u => ({
          name: u.name,
          email: u.email,
          type: u.userType,
          status: u.isActive ? 'Active' : 'Inactive',
          rating: u.rating,
          sessions: u.totalSessions
        }));
        filename = 'users-export.csv';
        break;
      case 'payments':
        data = sessions
          .filter(s => s.paymentAmount)
          .map(s => ({
            sessionId: s.id,
            candidate: s.candidateName,
            expert: s.expertName,
            amount: s.paymentAmount,
            status: s.paymentStatus,
            date: s.date
          }));
        filename = 'payments-export.csv';
        break;
      case 'recordings':
        data = sessions
          .filter(s => s.recordingUrl || s.isRecordingEnabled)
          .map(s => ({
            'Session ID': s.id,
            'Date': s.date,
            'Time': s.time,
            'Candidate': s.candidateName,
            'Expert': s.expertName,
            'Type': s.sessionType,
            'Status': s.status,
            'Duration (min)': s.duration,
            'Recording Available': s.recordingUrl ? 'Yes' : 'No',
            'Recording URL': s.recordingUrl || 'N/A'
          }));
        filename = `recordings-${new Date().toISOString().split('T')[0]}.csv`;
        break;
    }

    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} records`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {analytics && (
            <>
              {/* Period Selector */}
              <div className="flex justify-between items-center">
                <CardTitle>Platform Overview</CardTitle>
                <Select value={analyticsPeriod} onValueChange={(v: 'week' | 'month' | 'quarter') => setAnalyticsPeriod(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Key Metrics Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Interviews Booked</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.periodInterviews || analytics.totalSessions}</div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsPeriod === 'week' ? 'This week' : analyticsPeriod === 'month' ? 'This month' : 'This quarter'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${(analytics.totalRevenue || 0).toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                      ${(analytics.completedRevenue || 0).toFixed(2)} completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Platform Utilization</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.platformUtilizationRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">
                      Expert slots filled
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">New Sign-ups</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.newSignups?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.newSignups?.candidates || 0} candidates, {analytics.newSignups?.experts || 0} experts
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.activeUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.totalUsers} total users
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.totalSessions}</div>
                    <p className="text-xs text-muted-foreground">
                      All time sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Expert Rating</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.averageExpertRating?.toFixed(1) || analytics.averageRating.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">
                      Out of 5.0 stars
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Health</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.systemHealth?.serverUptime || 99.9}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      API: {analytics.systemHealth?.apiLatency || 0}ms
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {analytics && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sessions by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.sessionsByStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Users by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.usersByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="capitalize">{type}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <>
              {/* Period Selector */}
              <div className="flex justify-between items-center">
                <CardTitle>Advanced Analytics</CardTitle>
                <Select value={analyticsPeriod} onValueChange={(v: 'week' | 'month' | 'quarter') => setAnalyticsPeriod(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Charts Section */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Interviews Over Time Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Interviews Over Time</CardTitle>
                    <CardDescription>Bookings per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.sessionsOverTime && analytics.sessionsOverTime.length > 0 ? (
                      <div className="space-y-2">
                        <div className="h-64 flex items-end gap-1">
                          {analytics.sessionsOverTime.map((item, idx) => {
                            const maxCount = Math.max(...analytics.sessionsOverTime!.map(i => i.count));
                            const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                                  style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                                  title={`${item.date}: ${item.count} interviews`}
                                />
                                <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          Total: {analytics.sessionsOverTime.reduce((sum, item) => sum + item.count, 0)} interviews
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue Over Time Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Over Time</CardTitle>
                    <CardDescription>Earnings per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.revenueOverTime && analytics.revenueOverTime.length > 0 ? (
                      <div className="space-y-2">
                        <div className="h-64 flex items-end gap-1">
                          {analytics.revenueOverTime.map((item, idx) => {
                            const maxAmount = Math.max(...analytics.revenueOverTime!.map(i => i.amount));
                            const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors"
                                  style={{ height: `${height}%`, minHeight: item.amount > 0 ? '4px' : '0' }}
                                  title={`${item.date}: $${item.amount.toFixed(2)}`}
                                />
                                <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          Total: ${analytics.revenueOverTime.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Popular Expertise Areas Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Popular Expertise Areas</CardTitle>
                    <CardDescription>Most booked interview types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.popularExpertiseAreas && analytics.popularExpertiseAreas.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.popularExpertiseAreas.slice(0, 8).map((area) => {
                          const maxCount = Math.max(...analytics.popularExpertiseAreas!.map(a => a.count));
                          const width = maxCount > 0 ? (area.count / maxCount) * 100 : 0;
                          return (
                            <div key={area.type} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize">{area.type.replace('_', ' ')}</span>
                                <span className="font-semibold">{area.count}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${sessions.reduce((sum, s) => sum + (s.paymentAmount || 0), 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From {sessions.filter(s => s.paymentStatus === 'completed').length} completed payments
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {sessions.length > 0 
                        ? Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)
                        : 0} min
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average across all sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {sessions.length > 0
                        ? Math.round((analytics.sessionsByStatus.completed || 0) / sessions.length * 100)
                        : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.sessionsByStatus.completed || 0} completed sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.sessionsByStatus.in_progress || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Currently in progress
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Session Types Distribution</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => exportData('sessions')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(
                        sessions.reduce((acc, s) => {
                          acc[s.sessionType] = (acc[s.sessionType] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${(count / sessions.length) * 100}%`
                                }}
                              />
                            </div>
                            <Badge>{count}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Payment Status</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => exportData('payments')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(
                        sessions.reduce((acc, s) => {
                          const status = s.paymentStatus || 'pending';
                          acc[status] = (acc[status] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center">
                          <span className="capitalize">{status}</span>
                          <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>User Activity Summary</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => exportData('users')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Users
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Top Experts</p>
                      <div className="space-y-1">
                        {users
                          .filter(u => u.userType === 'expert')
                          .sort((a, b) => (b.totalSessions || 0) - (a.totalSessions || 0))
                          .slice(0, 5)
                          .map(u => (
                            <div key={u.id} className="flex justify-between text-sm">
                              <span>{u.name}</span>
                              <Badge variant="outline">{u.totalSessions || 0} sessions</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Top Candidates</p>
                      <div className="space-y-1">
                        {users
                          .filter(u => u.userType === 'candidate')
                          .sort((a, b) => (b.totalSessions || 0) - (a.totalSessions || 0))
                          .slice(0, 5)
                          .map(u => (
                            <div key={u.id} className="flex justify-between text-sm">
                              <span>{u.name}</span>
                              <Badge variant="outline">{u.totalSessions || 0} sessions</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Recent Activity</p>
                      <div className="space-y-1 text-sm">
                        <div>New users today: {users.filter(u => {
                          const created = new Date(u.createdAt);
                          const today = new Date();
                          return created.toDateString() === today.toDateString();
                        }).length}</div>
                        <div>Sessions today: {sessions.filter(s => {
                          const sessionDate = new Date(s.date);
                          const today = new Date();
                          return sessionDate.toDateString() === today.toDateString();
                        }).length}</div>
                        <div>Reviews today: {reviews.filter(r => {
                          const reviewDate = new Date(r.createdAt);
                          const today = new Date();
                          return reviewDate.toDateString() === today.toDateString();
                        }).length}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <CardTitle>System Monitoring</CardTitle>
            <Select value={monitoringTimeRange} onValueChange={(v: '5m' | '15m' | '1h' | '24h') => setMonitoringTimeRange(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">Last 5 min</SelectItem>
                <SelectItem value="15m">Last 15 min</SelectItem>
                <SelectItem value="1h">Last hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {monitoring && (
            <>
              {/* Load Testing */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Load Testing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Max Concurrent Meetings</p>
                      <p className="text-2xl font-bold">{monitoring.loadTesting?.maxConcurrentMeetings || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Concurrent Meetings</p>
                      <p className="text-2xl font-bold">{monitoring.loadTesting?.currentConcurrentMeetings || 0}</p>
                    </div>
                  </div>
                  {monitoring.loadTesting?.videoPlaybackLoad && monitoring.loadTesting.videoPlaybackLoad.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Recent Video Playback</p>
                      <div className="space-y-1">
                        {monitoring.loadTesting.videoPlaybackLoad.slice(-5).map((playback: any, idx: number) => (
                          <div key={idx} className="text-xs flex justify-between">
                            <span>Quality: {playback.quality || 'N/A'}</span>
                            <span>Bitrate: {playback.bitrate ? `${Math.round(playback.bitrate / 1000)}kbps` : 'N/A'}</span>
                            {playback.bufferingTime && <span>Buffering: {playback.bufferingTime.toFixed(2)}s</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* App Monitoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    App Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">API Latency (avg)</p>
                      <p className="text-2xl font-bold">{monitoring.appMonitoring?.apiLatency?.average || 0}ms</p>
                      <p className="text-xs text-muted-foreground">P95: {monitoring.appMonitoring?.apiLatency?.p95 || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                      <p className={`text-2xl font-bold ${(monitoring.appMonitoring?.errorRate || 0) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                        {(monitoring.appMonitoring?.errorRate || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{monitoring.appMonitoring?.totalRequests || 0}</p>
                      <p className="text-xs text-muted-foreground">{monitoring.appMonitoring?.failedRequests || 0} failed</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Server CPU</p>
                      <p className={`text-2xl font-bold ${(monitoring.appMonitoring?.serverCpu?.current || 0) > 80 ? 'text-red-500' : 'text-green-500'}`}>
                        {(monitoring.appMonitoring?.serverCpu?.current || 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Load: {monitoring.appMonitoring?.serverCpu?.loadAvg?.toFixed(2) || 0}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Server Memory</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Used:</span>
                          <span className="font-bold">{monitoring.appMonitoring?.serverMemory?.current?.used || 0} MB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <span className="font-bold">{monitoring.appMonitoring?.serverMemory?.current?.total || 0} MB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Usage:</span>
                          <span className={`font-bold ${(monitoring.appMonitoring?.serverMemory?.current?.percent || 0) > 80 ? 'text-red-500' : 'text-green-500'}`}>
                            {(monitoring.appMonitoring?.serverMemory?.current?.percent || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Real-Time Comms */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Real-Time Communications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">WebSocket Connections</p>
                      <p className="text-2xl font-bold">{monitoring.realtimeComms?.websocketConnections || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Jitter (avg)</p>
                      <p className="text-2xl font-bold">{monitoring.realtimeComms?.jitter?.average?.toFixed(2) || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Packet Loss (avg)</p>
                      <p className={`text-2xl font-bold ${(monitoring.realtimeComms?.packetLoss?.average || 0) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                        {(monitoring.realtimeComms?.packetLoss?.average || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bitrate (avg)</p>
                      <p className="text-2xl font-bold">
                        {monitoring.realtimeComms?.bitrate?.average ? `${Math.round(monitoring.realtimeComms.bitrate.average / 1000)}kbps` : '0kbps'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Distributed Tracing */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Distributed Tracing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Service Latency</p>
                    <div className="space-y-2">
                      {monitoring.distributedTracing?.serviceLatency?.map((service: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="font-medium">{service.service}</span>
                          <div className="flex gap-4">
                            <span className="text-sm">Avg: {service.average}ms</span>
                            <span className="text-sm text-muted-foreground">Count: {service.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {monitoring.distributedTracing?.bottlenecks && monitoring.distributedTracing.bottlenecks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-red-500">Bottlenecks Detected</p>
                      <div className="space-y-2">
                        {monitoring.distributedTracing.bottlenecks.map((bottleneck: any, idx: number) => (
                          <div key={idx} className={`p-2 rounded border ${bottleneck.severity === 'high' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
                            <div className="flex justify-between">
                              <span className="font-medium">{bottleneck.service}</span>
                              <Badge variant={bottleneck.severity === 'high' ? 'destructive' : 'secondary'}>
                                {bottleneck.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Recent: {bottleneck.recentLatency}ms (Avg: {bottleneck.avgLatency}ms)
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Video Playback */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Video Playback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Buffering Time (avg)</p>
                      <p className="text-2xl font-bold">{monitoring.videoPlayback?.bufferingTime?.average?.toFixed(2) || 0}s</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CDN Cache Hit Ratio</p>
                      <p className={`text-2xl font-bold ${(monitoring.videoPlayback?.cdnCacheHitRatio || 0) > 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                        {(monitoring.videoPlayback?.cdnCacheHitRatio || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CDN Cache Hits</p>
                      <p className="text-2xl font-bold">{monitoring.videoPlayback?.cdnCacheHits || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CDN Cache Misses</p>
                      <p className="text-2xl font-bold">{monitoring.videoPlayback?.cdnCacheMisses || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Logging */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Error Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {monitoringErrors.length > 0 ? (
                        monitoringErrors.slice(0, 20).map((error: any, idx: number) => (
                          <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{error.type || 'Error'}</span>
                              <span className="text-muted-foreground">
                                {new Date(error.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-muted-foreground">{error.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No errors in the selected time range</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      User Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {monitoringActivity.length > 0 ? (
                        monitoringActivity.slice(0, 20).map((activity: any, idx: number) => (
                          <div key={idx} className="p-2 bg-muted rounded text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{activity.action}</span>
                              <span className="text-muted-foreground">
                                {new Date(activity.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-muted-foreground">User: {activity.userId}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No activity in the selected time range</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">{Math.floor((monitoring.systemInfo?.uptime || 0) / 3600)}h {Math.floor(((monitoring.systemInfo?.uptime || 0) % 3600) / 60)}m</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Node Version</p>
                      <p className="font-medium">{monitoring.systemInfo?.nodeVersion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Platform</p>
                      <p className="font-medium">{monitoring.systemInfo?.platform || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Memory</p>
                      <p className="font-medium">{monitoring.systemInfo?.totalMemory || 0} MB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Session Calendar
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setCalendarDate(newDate);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCalendarDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setCalendarDate(newDate);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Select value={calendarView} onValueChange={(v: 'month' | 'week') => setCalendarView(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CardDescription>
                {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminCalendarView
                sessions={sessions}
                currentDate={calendarDate}
                view={calendarView}
                onSessionClick={(session: Session) => {
                  setSelectedSession(session);
                  setEditSessionOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>All Sessions</CardTitle>
                  <CardDescription>Manage all interview sessions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={sessionFilters.status} onValueChange={(v) => setSessionFilters({...sessionFilters, status: v})}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => exportData('sessions')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div>{session.date}</div>
                        <div className="text-sm text-muted-foreground">{session.time}</div>
                      </TableCell>
                      <TableCell>{session.candidateName}</TableCell>
                      <TableCell>{session.expertName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.sessionType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{session.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {session.paymentAmount ? `$${session.paymentAmount}` : '-'}
                        {session.paymentStatus && (
                          <div className="text-xs text-muted-foreground">{session.paymentStatus}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {session.meetingId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/meeting/${session.meetingId}?tab=feedback`)}
                              title="View Feedback"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(session);
                              setEditSessionOpen(true);
                            }}
                            title="Edit Session"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSession(session.id)}
                            title="Delete Session"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage all users in the system</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setAddUserOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New User
                  </Button>
                  <Input
                    placeholder="Search users..."
                    value={userFilters.search}
                    onChange={(e) => setUserFilters({...userFilters, search: e.target.value})}
                    className="w-48"
                  />
                  <Select value={userFilters.type} onValueChange={(v) => setUserFilters({...userFilters, type: v})}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="candidate">Candidates</SelectItem>
                      <SelectItem value="expert">Experts</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userFilters.status} onValueChange={(v) => setUserFilters({...userFilters, status: v})}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Sign-up Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users
                    .filter(u => {
                      if (userFilters.type !== 'all' && u.userType !== userFilters.type) return false;
                      if (userFilters.status === 'active' && !u.isActive) return false;
                      if (userFilters.status === 'inactive' && u.isActive) return false;
                      if (userFilters.status === 'unverified' && u.userType === 'expert' && u.isVerified) return false;
                      if (userFilters.search && !u.name.toLowerCase().includes(userFilters.search.toLowerCase()) && !u.email.toLowerCase().includes(userFilters.search.toLowerCase())) return false;
                      return true;
                    })
                    .map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.userType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? 'default' : 'secondary'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.rating ? `${u.rating.toFixed(1)} ⭐` : '-'}
                      </TableCell>
                      <TableCell>{u.totalSessions || 0}</TableCell>
                      <TableCell>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const response = await apiService.getUserDetails(u.id);
                              if (response.success) {
                                setSelectedUserDetail(response.data?.data || response.data);
                                setUserDetailOpen(true);
                              }
                            }}
                            title="View Details"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditUserOpen(true);
                            }}
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {u.userType === 'expert' && !u.isVerified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm(`Approve expert ${u.name}?`)) {
                                  const response = await apiService.approveExpert(u.id, true);
                                  if (response.success) {
                                    toast.success('Expert approved');
                                    loadData();
                                  }
                                }
                              }}
                              title="Approve Expert"
                            >
                              <Star className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Reviews & Feedback</CardTitle>
              <CardDescription>View all interview feedback and reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {review.session.title}
                          </CardTitle>
                          <CardDescription>
                            {review.reviewer.name} → {review.reviewee.name}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {review.comment && (
                        <p className="text-sm">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(review.createdAt)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recordings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    All Recordings
                  </CardTitle>
                  <CardDescription>View and manage all session recordings</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {sessions.filter(s => s.recordingUrl).length} recordings available
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => exportData('recordings')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sessions.filter(s => s.recordingUrl || s.isRecordingEnabled).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Expert</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions
                      .filter(s => s.recordingUrl || s.isRecordingEnabled)
                      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
                      .map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div>{session.date}</div>
                            <div className="text-sm text-muted-foreground">{session.time}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{session.sessionType}</div>
                            <div className="text-sm text-muted-foreground">{session.duration} min</div>
                          </TableCell>
                          <TableCell>{session.candidateName}</TableCell>
                          <TableCell>{session.expertName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.sessionType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge>{session.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {session.recordingUrl ? (
                              <Badge variant="default" className="bg-green-600">
                                Available
                              </Badge>
                            ) : session.isRecordingEnabled ? (
                              <Badge variant="secondary">Processing...</Badge>
                            ) : (
                              <Badge variant="outline">No recording</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {session.recordingUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    // Always get fresh signed URL (handles expired tokens automatically)
                                    await apiService.openRecordingUrl(session.id, session.recordingUrl);
                                  } catch (error) {
                                    console.error('Error opening recording:', error);
                                    toast.error('Failed to open recording. Please try again.');
                                  }
                                }}
                              >
                                <Video className="h-4 w-4 mr-2" />
                                View Recording
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">No recording</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No recordings available</h3>
                  <p className="text-gray-500">Recordings will appear here once sessions are completed and recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Participants to Sessions</CardTitle>
              <CardDescription>Add additional participants to interview sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Current Participants</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="font-medium">{session.candidateName} & {session.expertName}</div>
                        <div className="text-sm text-muted-foreground">{session.sessionType}</div>
                      </TableCell>
                      <TableCell>
                        <div>{session.date}</div>
                        <div className="text-sm text-muted-foreground">{session.time}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{session.candidateName}</Badge>
                          <Badge variant="outline">{session.expertName}</Badge>
                          {session.additionalParticipants && session.additionalParticipants.length > 0 && (
                            <>
                              {session.additionalParticipants.map((pid) => {
                                const participant = users.find(u => u.id === pid);
                                return participant ? (
                                  <Badge key={pid} variant="secondary">{participant.name}</Badge>
                                ) : null;
                              })}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSession(session);
                            setSelectedParticipants([]);
                            setAddParticipantsOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${financialSummary?.totalRevenue?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  All transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Platform Commission</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${financialSummary?.totalCommission?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  20% commission rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${financialSummary?.totalPayouts?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  To experts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {financialSummary?.transactionCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total transactions
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Transaction History</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportData('payments')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                      <TableCell>{t.candidate}</TableCell>
                      <TableCell>{t.expert}</TableCell>
                      <TableCell>${t.amount?.toFixed(2)}</TableCell>
                      <TableCell>${t.platformCommission?.toFixed(2)}</TableCell>
                      <TableCell>${t.expertPayout?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'completed' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Expert Payouts</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = [
                    'Expert,Email,Total Earnings,Platform Commission,Payout Amount,Sessions',
                    ...payouts.map(p => `"${p.expertName}","${p.expertEmail}",${p.totalEarnings},${p.platformCommission},${p.payoutAmount},${p.sessionCount}`)
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'payouts-export.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Payouts exported');
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Payouts
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Payout Amount</TableHead>
                    <TableHead>Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.expertId}>
                      <TableCell>{p.expertName}</TableCell>
                      <TableCell>{p.expertEmail}</TableCell>
                      <TableCell>${p.totalEarnings?.toFixed(2)}</TableCell>
                      <TableCell>${p.platformCommission?.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">${p.payoutAmount?.toFixed(2)}</TableCell>
                      <TableCell>{p.sessionCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expertise Areas Management</CardTitle>
              <CardDescription>Manage available interview types and skills</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Available Session Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {['technical', 'behavioral', 'system_design', 'resume', 'mock_interview', 'coding_challenge'].map((type) => (
                      <Badge key={type} variant="outline" className="px-3 py-1">
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Session types are currently managed in the database schema. To add new types, update the SessionType enum in the Prisma schema.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Featured Experts</CardTitle>
              <CardDescription>Manage featured experts on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users
                    .filter(u => u.userType === 'expert')
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 10)
                    .map((expert) => (
                      <TableRow key={expert.id}>
                        <TableCell>{expert.name}</TableCell>
                        <TableCell>
                          {expert.rating ? `${expert.rating.toFixed(1)} ⭐` : '-'}
                        </TableCell>
                        <TableCell>{expert.totalSessions || 0}</TableCell>
                        <TableCell>
                          <Badge variant={expert.isVerified ? 'default' : 'secondary'}>
                            {expert.isVerified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(expert);
                              setEditUserOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Configuration</CardTitle>
              <CardDescription>Manage platform settings and policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold">Cancellation Policy</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Set rules for session cancellations
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="cancel24h" defaultChecked className="rounded" />
                      <label htmlFor="cancel24h" className="text-sm">
                        Allow cancellation up to 24 hours before session
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="refundPolicy" defaultChecked className="rounded" />
                      <label htmlFor="refundPolicy" className="text-sm">
                        Automatic refund for cancellations within policy
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Rescheduling Policy</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Set rules for session rescheduling
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="reschedule48h" defaultChecked className="rounded" />
                      <label htmlFor="reschedule48h" className="text-sm">
                        Allow rescheduling up to 48 hours before session
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Commission Rates</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Platform commission percentage
                  </p>
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue={20} className="w-24" />
                    <span className="text-sm">%</span>
                    <span className="text-sm text-muted-foreground">(Experts receive {100 - 20}%)</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">System Health</Label>
                  <div className="mt-2 space-y-2">
                    {analytics?.systemHealth && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">API Latency</span>
                          <Badge variant={analytics.systemHealth.apiLatency < 50 ? 'default' : 'secondary'}>
                            {analytics.systemHealth.apiLatency}ms
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Server Uptime</span>
                          <Badge variant="default">
                            {analytics.systemHealth.serverUptime}%
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Video Integration</span>
                          <Badge variant="default">
                            {analytics.systemHealth.videoIntegrationStatus}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Reports</CardTitle>
              <CardDescription>Generate custom reports and exports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" onClick={() => exportData('sessions')} className="justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Sessions
                  </Button>
                  <Button variant="outline" onClick={() => exportData('users')} className="justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Users
                  </Button>
                  <Button variant="outline" onClick={() => exportData('payments')} className="justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export Financial Data
                  </Button>
                  <Button variant="outline" onClick={() => {
                    const noShowSessions = sessions.filter(s => s.status === 'cancelled');
                    const csv = [
                      'Session ID,Candidate,Expert,Date,Status',
                      ...noShowSessions.map(s => `"${s.id}","${s.candidateName}","${s.expertName}","${s.date}","${s.status}"`)
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'no-show-report.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    toast.success('No-show report exported');
                  }} className="justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    No-Show Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Session Dialog */}
      <Dialog open={editSessionOpen} onOpenChange={setEditSessionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>Update session details</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <EditSessionForm
              session={selectedSession}
              onSave={(data) => handleUpdateSession(selectedSession.id, data)}
              onCancel={() => setEditSessionOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <EditUserForm
              user={selectedUser}
              onSave={(data) => handleUpdateUser(selectedUser.id, data)}
              onCancel={() => setEditUserOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={userDetailOpen} onOpenChange={setUserDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Complete user information and history</DialogDescription>
          </DialogHeader>
          {selectedUserDetail && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-semibold">Name</Label>
                  <p className="text-sm">{selectedUserDetail.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm">{selectedUserDetail.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">User Type</Label>
                  <Badge variant="outline">{selectedUserDetail.userType}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Status</Label>
                  <Badge variant={selectedUserDetail.isActive ? 'default' : 'secondary'}>
                    {selectedUserDetail.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {selectedUserDetail.userType === 'expert' && (
                  <>
                    <div>
                      <Label className="text-sm font-semibold">Verified</Label>
                      <Badge variant={selectedUserDetail.isVerified ? 'default' : 'secondary'}>
                        {selectedUserDetail.isVerified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Rating</Label>
                      <p className="text-sm">{selectedUserDetail.rating ? `${selectedUserDetail.rating.toFixed(1)} ⭐` : 'N/A'}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedUserDetail.userType === 'candidate' && selectedUserDetail.candidateSessions && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Booking History</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedUserDetail.candidateSessions.map((session: any) => (
                      <div key={session.id} className="border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{session.sessionType}</span>
                          <Badge variant="outline">{session.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.scheduledDate).toLocaleString()} with {session.expert?.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUserDetail.userType === 'expert' && selectedUserDetail.expertSessions && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Session History</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedUserDetail.expertSessions.map((session: any) => (
                      <div key={session.id} className="border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{session.sessionType}</span>
                          <Badge variant="outline">{session.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.scheduledDate).toLocaleString()} with {session.candidate?.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUserDetail.reviewsReceived && selectedUserDetail.reviewsReceived.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Reviews Received</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedUserDetail.reviewsReceived.map((review: any) => (
                      <div key={review.id} className="border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{review.reviewer?.name}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <AddUserForm
            onSave={async (userData: any) => {
              try {
                const response = await apiService.createUser(userData);
                if (response.success) {
                  toast.success('User created successfully');
                  setAddUserOpen(false);
                  loadData();
                } else {
                  toast.error(response.message || 'Failed to create user');
                }
              } catch (error: any) {
                toast.error(error.message || 'Failed to create user');
              }
            }}
            onCancel={() => setAddUserOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Participants Dialog */}
      <Dialog open={addParticipantsOpen} onOpenChange={setAddParticipantsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Participants</DialogTitle>
            <DialogDescription>Select users to add to this session</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Participants</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {users
                    .filter(u => 
                      u.id !== selectedSession.candidateId && 
                      u.id !== selectedSession.expertId &&
                      u.userType !== 'admin'
                    )
                    .map((u) => (
                      <div key={u.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={u.id}
                          checked={selectedParticipants.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants([...selectedParticipants, u.id]);
                            } else {
                              setSelectedParticipants(selectedParticipants.filter(id => id !== u.id));
                            }
                          }}
                        />
                        <label htmlFor={u.id} className="text-sm">
                          {u.name} ({u.email}) - {u.userType}
                        </label>
                      </div>
                    ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddParticipantsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddParticipants} disabled={selectedParticipants.length === 0}>
                  Add Participants
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditSessionForm({ session, onSave, onCancel }: { session: Session; onSave: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    date: session.date,
    time: session.time,
    duration: session.duration,
    sessionType: session.sessionType,
    status: session.status,
    paymentAmount: session.paymentAmount || 0,
    paymentStatus: session.paymentStatus || 'pending'
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div>
          <Label>Time</Label>
          <Input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Duration (minutes)</Label>
          <Input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label>Session Type</Label>
          <Select value={formData.sessionType} onValueChange={(value) => setFormData({ ...formData, sessionType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="system_design">System Design</SelectItem>
              <SelectItem value="resume">Resume</SelectItem>
              <SelectItem value="mock_interview">Mock Interview</SelectItem>
              <SelectItem value="coding_challenge">Coding Challenge</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payment Status</Label>
          <Select value={formData.paymentStatus} onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Payment Amount</Label>
        <Input
          type="number"
          value={formData.paymentAmount}
          onChange={(e) => setFormData({ ...formData, paymentAmount: parseFloat(e.target.value) })}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)}>Save Changes</Button>
      </DialogFooter>
    </div>
  );
}

function EditUserForm({ user, onSave, onCancel }: { user: User; onSave: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    isVerified: user.isVerified || false
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div>
        <Label>User Type</Label>
        <Select value={formData.userType} onValueChange={(value) => setFormData({ ...formData, userType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="candidate">Candidate</SelectItem>
            <SelectItem value="expert">Expert</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
        />
        <label htmlFor="isActive" className="text-sm">Active</label>
      </div>
      {formData.userType === 'expert' && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isVerified"
            checked={formData.isVerified}
            onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
          />
          <label htmlFor="isVerified" className="text-sm">Verified</label>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)}>Save Changes</Button>
      </DialogFooter>
    </div>
  );
}

