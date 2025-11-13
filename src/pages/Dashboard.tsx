import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface DashboardStats {
  totalEmployees: number;
  pendingLeaves: number;
  todayAttendance: number;
  approvedLeaves: number;
}

interface Activity {
  id: string;
  action: string;
  description: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
  };
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    pendingLeaves: 0,
    todayAttendance: 0,
    approvedLeaves: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [userRole, user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch stats based on role
      if (userRole === 'admin') {
        const [employeesData, leavesData, attendanceData] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact' }),
          supabase.from('leaves').select('status', { count: 'exact' }),
          supabase.from('attendance').select('id', { count: 'exact' }).eq('date', new Date().toISOString().split('T')[0]),
        ]);

        const pendingLeaves = leavesData.data?.filter(l => l.status === 'pending').length || 0;
        const approvedLeaves = leavesData.data?.filter(l => l.status === 'approved').length || 0;

        setStats({
          totalEmployees: employeesData.count || 0,
          pendingLeaves,
          todayAttendance: attendanceData.count || 0,
          approvedLeaves,
        });
      } else {
        // Employee stats
        const [myLeavesData, myAttendanceData] = await Promise.all([
          supabase.from('leaves').select('status').eq('employee_id', user?.id),
          supabase.from('attendance').select('id', { count: 'exact' }).eq('employee_id', user?.id).eq('date', new Date().toISOString().split('T')[0]),
        ]);

        const pendingLeaves = myLeavesData.data?.filter(l => l.status === 'pending').length || 0;
        const approvedLeaves = myLeavesData.data?.filter(l => l.status === 'approved').length || 0;

        setStats({
          totalEmployees: 0,
          pendingLeaves,
          todayAttendance: myAttendanceData.count || 0,
          approvedLeaves,
        });
      }

      // Fetch recent activities
      const { data: activitiesData } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      setActivities(activitiesData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = userRole === 'admin' 
    ? [
        { title: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-primary' },
        { title: 'Pending Leaves', value: stats.pendingLeaves, icon: Calendar, color: 'text-warning' },
        { title: 'Today Attendance', value: stats.todayAttendance, icon: Clock, color: 'text-success' },
        { title: 'Approved Leaves', value: stats.approvedLeaves, icon: CheckCircle, color: 'text-success' },
      ]
    : [
        { title: 'Pending Leaves', value: stats.pendingLeaves, icon: Calendar, color: 'text-warning' },
        { title: 'Approved Leaves', value: stats.approvedLeaves, icon: CheckCircle, color: 'text-success' },
        { title: 'Today Attendance', value: stats.todayAttendance > 0 ? 'Marked' : 'Not Marked', icon: Clock, color: 'text-primary' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's an overview of your workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b last:border-0">
                  <div className="mt-1">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {activity.profiles.full_name}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {activity.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
