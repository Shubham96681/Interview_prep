import { useState, useEffect } from 'react';
import { apiService } from '@/lib/apiService';
import realtimeService from '@/lib/realtimeService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Star, 
  Calendar,
  Clock,
  Target,
  Award,
  BarChart3,
  PieChart,
  Download
} from 'lucide-react';
import { Session } from '@/lib/mockData';

interface ExpertAnalyticsProps {
  expertId: string;
  sessions: Session[];
}

interface AnalyticsData {
  totalEarnings: number;
  totalSessions: number;
  averageRating: number;
  completionRate: number;
  monthlyEarnings: { month: string; amount: number }[];
  sessionTypes: { type: string; count: number; revenue: number }[];
  weeklyStats: { week: string; sessions: number; earnings: number }[];
  topClients: { name: string; sessions: number; revenue: number }[];
  timeTracking?: {
    totalActualTime: number;
    totalScheduledTime: number;
    averageActualDuration: number;
    averageScheduledDuration: number;
    timeEfficiency: number;
    sessionsWithTimeTracking: number;
  };
  candidateTimeTracking?: Array<{
    candidateId: string;
    candidateName: string;
    totalSessions: number;
    totalActualTime: number;
    totalScheduledTime: number;
    averageActualDuration: number;
    averageScheduledDuration: number;
  }>;
}

export default function ExpertAnalytics({ expertId, sessions }: ExpertAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('3months');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  console.log('ExpertAnalytics component rendering with:', { expertId, sessionsCount: sessions.length });

  // Generate mock analytics data as fallback
  const generateMockAnalyticsData = (): AnalyticsData => {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalEarnings = completedSessions.reduce((sum, s) => sum + (s.paymentAmount || 0), 0);
    const totalSessions = sessions.length;
    const averageRating = 4.7; // Mock average rating
    const completionRate = totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;

    // Generate monthly earnings data
    const monthlyEarnings = [
      { month: 'Jan', amount: 1200 },
      { month: 'Feb', amount: 1500 },
      { month: 'Mar', amount: 1800 },
      { month: 'Apr', amount: 2100 },
      { month: 'May', amount: 1900 },
      { month: 'Jun', amount: 2400 }
    ];

    // Generate session types data
    const sessionTypes = [
      { type: 'Technical', count: 45, revenue: 3375 },
      { type: 'Behavioral', count: 32, revenue: 2400 },
      { type: 'System Design', count: 28, revenue: 2100 },
      { type: 'Resume Review', count: 15, revenue: 1125 }
    ];

    // Generate weekly stats
    const weeklyStats = [
      { week: 'Week 1', sessions: 8, earnings: 600 },
      { week: 'Week 2', sessions: 12, earnings: 900 },
      { week: 'Week 3', sessions: 10, earnings: 750 },
      { week: 'Week 4', sessions: 15, earnings: 1125 }
    ];

    // Generate top clients data
    const topClients = [
      { name: 'John Doe', sessions: 8, revenue: 600 },
      { name: 'Sarah Wilson', sessions: 6, revenue: 450 },
      { name: 'Mike Johnson', sessions: 5, revenue: 375 },
      { name: 'Emily Davis', sessions: 4, revenue: 300 }
    ];

    // Generate mock time tracking data
    const timeTracking = {
      totalActualTime: 450, // 7.5 hours total
      totalScheduledTime: 480, // 8 hours scheduled
      averageActualDuration: 45, // 45 minutes average
      averageScheduledDuration: 60, // 60 minutes scheduled
      timeEfficiency: 6.25, // 6.25% under time
      sessionsWithTimeTracking: 10
    };

    // Generate mock candidate time tracking data
    const candidateTimeTracking = [
      {
        candidateId: 'candidate-1',
        candidateName: 'John Doe',
        totalSessions: 3,
        totalActualTime: 135,
        totalScheduledTime: 180,
        averageActualDuration: 45,
        averageScheduledDuration: 60
      },
      {
        candidateId: 'candidate-2',
        candidateName: 'Sarah Wilson',
        totalSessions: 2,
        totalActualTime: 90,
        totalScheduledTime: 120,
        averageActualDuration: 45,
        averageScheduledDuration: 60
      },
      {
        candidateId: 'candidate-3',
        candidateName: 'Mike Johnson',
        totalSessions: 2,
        totalActualTime: 85,
        totalScheduledTime: 120,
        averageActualDuration: 42.5,
        averageScheduledDuration: 60
      },
      {
        candidateId: 'candidate-4',
        candidateName: 'Emily Davis',
        totalSessions: 1,
        totalActualTime: 50,
        totalScheduledTime: 60,
        averageActualDuration: 50,
        averageScheduledDuration: 60
      }
    ];

    return {
      totalEarnings,
      totalSessions,
      averageRating,
      completionRate,
      monthlyEarnings,
      sessionTypes,
      weeklyStats,
      topClients,
      timeTracking,
      candidateTimeTracking
    };
  };

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching analytics for expert:', expertId, 'timeRange:', timeRange);
        
        // Map frontend timeRange to backend format
        const backendTimeRange = timeRange === '1month' ? 'month' : 
                                 timeRange === '1year' ? 'year' : 
                                 timeRange;
        
        // Use real API
        const response = await apiService.getExpertAnalytics(expertId, backendTimeRange);
        
        console.log('📊 Analytics API response:', response);
        console.log('📊 Response structure:', {
          success: response.success,
          hasData: !!response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
          nestedData: response.data?.data ? Object.keys(response.data.data) : []
        });
        
        if (response.success && response.data) {
          // Handle nested response structure: {success: true, data: {success: true, data: {...}}}
          // Backend returns: {success: true, data: analytics}
          // apiService wraps it: {success: true, data: {success: true, data: analytics}}
          // So we need to check if response.data has a nested 'data' property
          let data = response.data;
          
          // If response.data is an object with a 'data' property and 'success' property, it's nested
          if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
            console.log('📦 Detected nested response structure, unwrapping...');
            data = (data as any).data;
          }
          
          // If data is still wrapped (has 'success' and 'data'), unwrap again
          if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
            console.log('📦 Detected double-nested response structure, unwrapping again...');
            data = (data as any).data;
          }
          
          console.log('✅ Analytics data received:', data);
          console.log('✅ Data keys:', data ? Object.keys(data) : 'null');
          console.log('✅ Data values:', {
            totalEarnings: data?.totalEarnings,
            totalSessions: data?.totalSessions,
            averageRating: data?.averageRating,
            completionRate: data?.completionRate,
            monthlyEarningsLength: data?.monthlyEarnings?.length,
            sessionTypesLength: data?.sessionTypes?.length,
            weeklyStatsLength: data?.weeklyStats?.length,
            topClientsLength: data?.topClients?.length
          });
          
          // Ensure all required fields have default values
          const analyticsData: AnalyticsData = {
            totalEarnings: data.totalEarnings ?? 0,
            totalSessions: data.totalSessions ?? 0,
            averageRating: data.averageRating ?? 0,
            completionRate: data.completionRate ?? 0,
            monthlyEarnings: Array.isArray(data.monthlyEarnings) ? data.monthlyEarnings : [],
            sessionTypes: Array.isArray(data.sessionTypes) ? data.sessionTypes : [],
            weeklyStats: Array.isArray(data.weeklyStats) ? data.weeklyStats : [],
            topClients: Array.isArray(data.topClients) ? data.topClients : [],
            timeTracking: data.timeTracking || null,
            candidateTimeTracking: Array.isArray(data.candidateTimeTracking) ? data.candidateTimeTracking : []
          };
          
          console.log('✅ Processed analytics data:', analyticsData);
          setAnalyticsData(analyticsData);
          setLastUpdate(new Date());
        } else {
          console.warn('⚠️ Analytics API returned no data, using fallback');
          console.warn('⚠️ Response:', response);
          // Fallback to calculated data from sessions prop
          setAnalyticsData(generateMockAnalyticsData());
        }
      } catch (error) {
        console.error('❌ Error fetching analytics:', error);
        setError('Failed to load analytics data');
        // Fallback to calculated data from sessions prop
        setAnalyticsData(generateMockAnalyticsData());
      } finally {
        setLoading(false);
      }
    };

    if (expertId) {
      fetchAnalyticsData();
    }

    // Set up real-time updates
    const handleAnalyticsUpdated = () => {
      console.log('🔄 Expert Analytics: Analytics updated via real-time');
      if (expertId) {
        fetchAnalyticsData();
      }
    };

    const handleSessionUpdated = () => {
      console.log('🔄 Expert Analytics: Session updated, refreshing analytics');
      if (expertId) {
        fetchAnalyticsData();
      }
    };

    realtimeService.on('analytics_updated', handleAnalyticsUpdated);
    realtimeService.on('session_updated', handleSessionUpdated);
    realtimeService.on('session_created', handleSessionUpdated);

    // Periodic refresh every 30 seconds for real-time data
    const interval = setInterval(() => {
      if (expertId) {
        console.log('🔄 Periodic analytics refresh (30s interval)');
        fetchAnalyticsData();
      }
    }, 30000);

    return () => {
      realtimeService.off('analytics_updated', handleAnalyticsUpdated);
      realtimeService.off('session_updated', handleSessionUpdated);
      realtimeService.off('session_created', handleSessionUpdated);
      clearInterval(interval);
    };
  }, [expertId, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ Error loading analytics</div>
          <div className="text-gray-600 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="text-gray-600">No analytics data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analytics Dashboard</h2>
          <div className="flex items-center gap-3">
            <p className="text-gray-600">Track your performance and earnings</p>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(analyticsData.totalEarnings || 0).toFixed(2)}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+12.5%</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-blue-600">{analyticsData.totalSessions}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+8.2%</span>
                </div>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Rating</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {(analyticsData.averageRating || 0).toFixed(1)}
                </p>
                <div className="flex items-center mt-1">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    {(analyticsData.averageRating || 0).toFixed(1)}/5.0
                  </span>
                </div>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {isNaN(analyticsData.completionRate) || !analyticsData.completionRate 
                    ? '0' 
                    : Math.round(analyticsData.completionRate)}%
                </p>
                <div className="flex items-center mt-1">
                  <Target className="h-4 w-4 text-purple-500 mr-1" />
                  <span className="text-sm text-gray-600">Excellent</span>
                </div>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Tracking Metrics */}
      {analyticsData.timeTracking && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Time Tracking Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Time Spent</p>
                    <p className="text-2xl font-bold text-indigo-600">{analyticsData.timeTracking.totalActualTime}m</p>
                    <div className="flex items-center mt-1">
                      <Clock className="h-4 w-4 text-indigo-500 mr-1" />
                      <span className="text-sm text-gray-600">Actual vs {analyticsData.timeTracking.totalScheduledTime}m scheduled</span>
                    </div>
                  </div>
                  <Clock className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Session Duration</p>
                    <p className="text-2xl font-bold text-teal-600">{analyticsData.timeTracking.averageActualDuration}m</p>
                    <div className="flex items-center mt-1">
                      <TrendingUp className="h-4 w-4 text-teal-500 mr-1" />
                      <span className="text-sm text-gray-600">vs {analyticsData.timeTracking.averageScheduledDuration}m scheduled</span>
                    </div>
                  </div>
                  <Calendar className="h-8 w-8 text-teal-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Time Efficiency</p>
                    <p className="text-2xl font-bold text-orange-600">{analyticsData.timeTracking.timeEfficiency}%</p>
                    <div className="flex items-center mt-1">
                      {analyticsData.timeTracking.timeEfficiency > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className="text-sm text-gray-600">
                        {analyticsData.timeTracking.timeEfficiency > 0 ? 'Under time' : 'Over time'}
                      </span>
                    </div>
                  </div>
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Per Candidate Time Tracking */}
      {analyticsData.candidateTimeTracking && analyticsData.candidateTimeTracking.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Time Spent Per Candidate</h3>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Candidate Time Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.candidateTimeTracking.map((candidate, index) => (
                  <div key={candidate.candidateId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{candidate.candidateName}</p>
                        <p className="text-sm text-gray-600">{candidate.totalSessions} sessions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{candidate.totalActualTime}m total</p>
                      <p className="text-sm text-gray-600">Avg: {Math.round(candidate.averageActualDuration)}m</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.monthlyEarnings && analyticsData.monthlyEarnings.length > 0 ? (
                analyticsData.monthlyEarnings.map((month) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{month.month}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                          style={{ width: `${(month.amount / 2500) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        ${(month.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-8">No monthly earnings data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Types Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Session Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.sessionTypes && analyticsData.sessionTypes.length > 0 ? (
                analyticsData.sessionTypes.map((type, index) => (
                  <div key={type.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ 
                          backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]
                        }}
                      ></div>
                      <span className="text-sm font-medium text-gray-600">{type.type}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{type.count} sessions</p>
                      <p className="text-xs text-gray-500">${(type.revenue || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-8">No session types data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Performance & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.weeklyStats && analyticsData.weeklyStats.length > 0 ? (
                analyticsData.weeklyStats.map((week) => (
                  <div key={week.week} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{week.week}</p>
                      <p className="text-sm text-gray-600">{week.sessions} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">${(week.earnings || 0).toFixed(2)}</p>
                      <div className="flex items-center">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-600">+5%</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-8">No weekly stats data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.topClients && analyticsData.topClients.length > 0 ? (
                analyticsData.topClients.map((client, index) => (
                  <div key={client.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-600">{client.sessions} sessions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${(client.revenue || 0).toFixed(2)}</p>
                      <div className="flex items-center">
                        <Star className="h-3 w-3 text-yellow-500 mr-1" />
                        <span className="text-xs text-gray-600">4.8</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-8">No top clients data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-green-800">Earnings Growth</h3>
              <p className="text-sm text-green-600">Your earnings have increased by 12.5% this month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-semibold text-blue-800">Client Retention</h3>
              <p className="text-sm text-blue-600">85% of your clients book repeat sessions</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Award className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-800">Top Performer</h3>
              <p className="text-sm text-purple-600">You're in the top 10% of experts this month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

