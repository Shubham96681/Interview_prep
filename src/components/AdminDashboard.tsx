import { useState, useEffect } from 'react';
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
import { Trash2, Edit, Plus, Users, Calendar, Star, BarChart3 } from 'lucide-react';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [addParticipantsOpen, setAddParticipantsOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, usersRes, reviewsRes, analyticsRes] = await Promise.all([
        apiService.getAllSessions(),
        apiService.getAllUsers(),
        apiService.getAllReviews(),
        apiService.getAnalytics()
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
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {analytics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.activeUsers} active
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
                    {Object.values(analytics.sessionsByStatus).reduce((a, b) => a + b, 0)} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalReviews}</div>
                  <p className="text-xs text-muted-foreground">
                    Avg rating: {analytics.averageRating.toFixed(1)}/5
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">User Types</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.usersByType.candidate || 0} / {analytics.usersByType.expert || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Candidates / Experts
                  </p>
                </CardContent>
              </Card>
            </div>
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

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Sessions</CardTitle>
              <CardDescription>Manage all interview sessions</CardDescription>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(session);
                              setEditSessionOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSession(session.id)}
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
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage all users in the system</CardDescription>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(u);
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

