import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function Attendance() {
  const { user, userRole } = useAuth();
  const [hasMarkedToday, setHasMarkedToday] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkTodayAttendance();
  }, [user]);

  const checkTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('attendance')
        .select('id')
        .eq('employee_id', user?.id)
        .eq('date', today)
        .single();

      setHasMarkedToday(!!data);
    } catch (error) {
      setHasMarkedToday(false);
    }
  };

  const markAttendance = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('attendance').insert({
        employee_id: user?.id,
        date: today,
        check_in: new Date().toISOString(),
        status: 'present',
      });

      if (error) throw error;

      toast.success('Attendance marked successfully');
      setHasMarkedToday(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground mt-1">Track your daily attendance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-6 bg-muted rounded-lg">
            <div className="flex items-center gap-4">
              {hasMarkedToday ? (
                <CheckCircle className="h-8 w-8 text-success" />
              ) : (
                <Clock className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {format(new Date(), 'EEEE, MMMM dd, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasMarkedToday ? 'Attendance marked' : 'Not marked yet'}
                </p>
              </div>
            </div>
            <Button onClick={markAttendance} disabled={hasMarkedToday || loading}>
              {loading ? 'Marking...' : hasMarkedToday ? 'Marked' : 'Mark Attendance'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
