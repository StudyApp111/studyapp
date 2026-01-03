import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Activity, Clock, TrendingUp, MousePointer, 
  Smartphone, Monitor, Tablet, ArrowLeft, Search,
  Calendar, BarChart3, Eye, LogOut, Zap, School,
  RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { format, subDays, differenceInDays, parseISO } from "date-fns";

const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

export default function UserAnalytics() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedUsers, setExpandedUsers] = useState({});

  // Check admin access
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Fetch all users (paginated to get all)
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const allUsers = [];
      let skip = 0;
      const limit = 500;
      let hasMore = true;
      
      while (hasMore) {
        const batch = await base44.entities.User.list('-created_date', limit, skip);
        allUsers.push(...batch);
        skip += limit;
        hasMore = batch.length === limit;
      }
      
      return allUsers;
    },
    enabled: currentUser?.role === 'admin'
  });

  // Fetch user events
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['userEvents', dateRange],
    queryFn: async () => {
      const cutoffDate = subDays(new Date(), parseInt(dateRange)).toISOString();
      return base44.entities.UserEvent.filter(
        { timestamp: { $gte: cutoffDate } },
        '-timestamp',
        5000
      );
    },
    enabled: currentUser?.role === 'admin'
  });

  // Fetch learning profiles for school data (paginated)
  const { data: learningProfiles = [] } = useQuery({
    queryKey: ['learningProfiles'],
    queryFn: async () => {
      const allProfiles = [];
      let skip = 0;
      const limit = 500;
      let hasMore = true;
      
      while (hasMore) {
        const batch = await base44.entities.LearningProfile.list('-created_date', limit, skip);
        allProfiles.push(...batch);
        skip += limit;
        hasMore = batch.length === limit;
      }
      
      return allProfiles;
    },
    enabled: currentUser?.role === 'admin'
  });

  // Device breakdown - use events since user.device_type may not be set
  const deviceBreakdown = React.useMemo(() => {
    // First try to get from events (more accurate)
    const deviceFromEvents = {};
    events.forEach(e => {
      if (e.device_type && e.user_email) {
        deviceFromEvents[e.user_email] = e.device_type;
      }
    });
    
    // Count devices per user (use event data if available, else user data)
    const breakdown = {};
    users.forEach(u => {
      const device = deviceFromEvents[u.email] || u.device_type || 'unknown';
      breakdown[device] = (breakdown[device] || 0) + 1;
    });
    
    return breakdown;
  }, [users, events]);

  // Redirect if not admin
  useEffect(() => {
    if (!userLoading && currentUser && currentUser.role !== 'admin') {
      navigate(createPageUrl('Home'));
    }
  }, [currentUser, userLoading, navigate]);

  if (userLoading || currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Calculate metrics
  const totalUsers = users.length;
  const activeUsersLast7Days = users.filter(u => {
    if (!u.last_active_date) return false;
    return differenceInDays(new Date(), parseISO(u.last_active_date)) <= 7;
  }).length;
  
  const newUsersThisWeek = users.filter(u => {
    if (!u.created_date) return false;
    return differenceInDays(new Date(), parseISO(u.created_date)) <= 7;
  }).length;

  const avgSessionDuration = users.reduce((acc, u) => acc + (u.average_session_duration || 0), 0) / (totalUsers || 1);
  
  const retentionRate = totalUsers > 0 ? ((activeUsersLast7Days / totalUsers) * 100).toFixed(1) : 0;

  // Event analytics
  const eventsByType = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {});

  const topButtonClicks = events
    .filter(e => e.event_type === 'button_click')
    .reduce((acc, e) => {
      acc[e.event_name] = (acc[e.event_name] || 0) + 1;
      return acc;
    }, {});

  const topPages = events
    .filter(e => e.event_type === 'page_view')
    .reduce((acc, e) => {
      acc[e.event_name] = (acc[e.event_name] || 0) + 1;
      return acc;
    }, {});

  // School breakdown from learning profiles
  const schoolBreakdown = learningProfiles.reduce((acc, p) => {
    const school = p.school || 'Not specified';
    acc[school] = (acc[school] || 0) + 1;
    return acc;
  }, {});

  // Filter users
  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserExpand = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Get user's events
  const getUserEvents = (userEmail) => {
    return events.filter(e => e.user_email === userEmail).slice(0, 20);
  };

  // Get user's learning profile
  const getUserProfile = (userEmail) => {
    return learningProfiles.find(p => p.created_by === userEmail);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">User Behaviour Dashboard</h1>
              <p className="text-sm text-slate-500">Admin analytics & insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { refetchUsers(); refetchEvents(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
                  <p className="text-xs text-slate-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activeUsersLast7Days}</p>
                  <p className="text-xs text-slate-500">Active (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{retentionRate}%</p>
                  <p className="text-xs text-slate-500">Retention</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatDuration(avgSessionDuration)}</p>
                  <p className="text-xs text-slate-500">Avg Session</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Zap className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{newUsersThisWeek}</p>
                  <p className="text-xs text-slate-500">New (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="events">Event Analytics</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdowns</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card className="bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">User</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">Device</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">Sessions</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">Avg Duration</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">Last Active</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map(user => {
                      const profile = getUserProfile(user.email);
                      const userEvents = getUserEvents(user.email);
                      const isExpanded = expandedUsers[user.id];
                      const lastActiveDate = user.last_active_date ? parseISO(user.last_active_date) : null;
                      const daysSinceActive = lastActiveDate ? differenceInDays(new Date(), lastActiveDate) : null;

                      return (
                        <React.Fragment key={user.id}>
                          <tr 
                            className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => toggleUserExpand(user.id)}
                          >
                            <td className="p-3">
                              <div>
                                <p className="font-medium text-sm text-slate-900">{user.full_name || 'Unknown'}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                                {profile?.school && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <School className="w-3 h-3 text-slate-400" />
                                    <span className="text-xs text-slate-500">{profile.school}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {(() => {
                                // Get device from recent events for this user
                                const userEvent = events.find(e => e.user_email === user.email && e.device_type);
                                const deviceType = userEvent?.device_type || user.device_type;
                                return (
                                  <div className="flex items-center gap-1">
                                    {deviceType === 'mobile' && <Smartphone className="w-4 h-4 text-slate-400" />}
                                    {deviceType === 'tablet' && <Tablet className="w-4 h-4 text-slate-400" />}
                                    {deviceType === 'desktop' && <Monitor className="w-4 h-4 text-slate-400" />}
                                    {!deviceType && <Monitor className="w-4 h-4 text-slate-300" />}
                                    <span className="text-xs text-slate-600 capitalize">{deviceType || 'Unknown'}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3">
                              <span className="text-sm font-medium">{user.session_count || 0}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm">{formatDuration(user.average_session_duration)}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-slate-600">
                                {lastActiveDate ? format(lastActiveDate, 'MMM d, h:mm a') : 'Never'}
                              </span>
                            </td>
                            <td className="p-3">
                              {daysSinceActive === null ? (
                                <Badge variant="outline" className="text-slate-500">New</Badge>
                              ) : daysSinceActive <= 1 ? (
                                <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                              ) : daysSinceActive <= 7 ? (
                                <Badge className="bg-amber-100 text-amber-700">Recent</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="7" className="bg-slate-50 p-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  {/* User Details */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm text-slate-700">User Details</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-slate-500">Browser:</span>
                                        <span className="ml-1 font-medium">{user.browser || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">OS:</span>
                                        <span className="ml-1 font-medium">{user.operating_system || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Timezone:</span>
                                        <span className="ml-1 font-medium">{user.timezone || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Total Logins:</span>
                                        <span className="ml-1 font-medium">{user.total_logins || user.session_count || 0}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Questions Done:</span>
                                        <span className="ml-1 font-medium">{user.questions_completed || 0}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Study Time:</span>
                                        <span className="ml-1 font-medium">{formatDuration(user.time_spent_seconds)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">PWA Installed:</span>
                                        <span className="ml-1 font-medium">{user.is_pwa_installed ? 'Yes' : 'No'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Onboarded:</span>
                                        <span className="ml-1 font-medium">{user.onboarding_completed ? 'Yes' : 'No'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Joined:</span>
                                        <span className="ml-1 font-medium">{user.created_date ? format(parseISO(user.created_date), 'MMM d, yyyy') : 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Current Streak:</span>
                                        <span className="ml-1 font-medium">{user.current_streak || 0} days</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Total Points:</span>
                                        <span className="ml-1 font-medium">{user.total_points || 0}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Avg Score:</span>
                                        <span className="ml-1 font-medium">{user.average_score || 0}%</span>
                                      </div>
                                    </div>
                                    {profile ? (
                                      <div className="pt-2 border-t">
                                        <h5 className="font-semibold text-xs text-slate-600 mb-1">Learning Profile</h5>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div><span className="text-slate-500">School:</span> {profile.school || 'N/A'}</div>
                                          <div><span className="text-slate-500">Grade:</span> {profile.grade || 'N/A'}</div>
                                          <div><span className="text-slate-500">City:</span> {profile.city || 'N/A'}</div>
                                          <div><span className="text-slate-500">Country:</span> {profile.country || 'N/A'}</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="pt-2 border-t">
                                        <p className="text-xs text-slate-500 italic">No learning profile found</p>
                                      </div>
                                    )}
                                  </div>
                                  {/* Recent Events */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm text-slate-700">Recent Activity</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {userEvents.length > 0 ? userEvents.map((event, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs p-2 bg-white rounded border">
                                          <Badge variant="outline" className="text-[10px] shrink-0">
                                            {event.event_type}
                                          </Badge>
                                          <span className="font-medium truncate">{event.event_name}</span>
                                          <span className="text-slate-400 ml-auto shrink-0">
                                            {format(parseISO(event.timestamp), 'MMM d, h:mm a')}
                                          </span>
                                        </div>
                                      )) : (
                                        <p className="text-xs text-slate-500">No recent events tracked</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MousePointer className="w-4 h-4" />
                    Top Button Clicks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(topButtonClicks)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 10)
                      .map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 truncate flex-1">{name}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    {Object.keys(topButtonClicks).length === 0 && (
                      <p className="text-sm text-slate-500">No button clicks tracked yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Top Pages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(topPages)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 10)
                      .map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 truncate flex-1">{name}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    {Object.keys(topPages).length === 0 && (
                      <p className="text-sm text-slate-500">No page views tracked yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Events by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(eventsByType).map(([type, count]) => (
                    <Badge key={type} className="bg-purple-100 text-purple-700">
                      {type}: {count}
                    </Badge>
                  ))}
                  {Object.keys(eventsByType).length === 0 && (
                    <p className="text-sm text-slate-500">No events tracked in this period</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Breakdowns Tab */}
          <TabsContent value="breakdown" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Device Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(deviceBreakdown).map(([device, count]) => (
                      <div key={device} className="flex items-center gap-3">
                        {device === 'mobile' && <Smartphone className="w-5 h-5 text-purple-500" />}
                        {device === 'tablet' && <Tablet className="w-5 h-5 text-blue-500" />}
                        {device === 'desktop' && <Monitor className="w-5 h-5 text-emerald-500" />}
                        {device === 'unknown' && <Monitor className="w-5 h-5 text-slate-400" />}
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm capitalize">{device}</span>
                            <span className="text-sm font-medium">{count} ({((count / totalUsers) * 100).toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                device === 'mobile' ? 'bg-purple-500' :
                                device === 'tablet' ? 'bg-blue-500' :
                                device === 'desktop' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${(count / totalUsers) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <School className="w-4 h-4" />
                    Schools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(schoolBreakdown)
                      .sort(([,a], [,b]) => b - a)
                      .map(([school, count]) => (
                        <div key={school} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 truncate flex-1">{school}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Drop-off Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm">Users who never completed onboarding</span>
                    <Badge className="bg-red-100 text-red-700">
                      {users.filter(u => !u.onboarding_completed).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm">Users with only 1 session</span>
                    <Badge className="bg-amber-100 text-amber-700">
                      {users.filter(u => (u.session_count || 0) === 1).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm">Users inactive for 30+ days</span>
                    <Badge className="bg-orange-100 text-orange-700">
                      {users.filter(u => {
                        if (!u.last_active_date) return true;
                        return differenceInDays(new Date(), parseISO(u.last_active_date)) > 30;
                      }).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm">Power users (10+ sessions)</span>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {users.filter(u => (u.session_count || 0) >= 10).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}