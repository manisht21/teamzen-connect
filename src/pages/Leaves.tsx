import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';

interface Leave {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function Leaves() {
  const { user, userRole } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filteredLeaves, setFilteredLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: 'vacation',
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    fetchLeaves();
  }, [user, userRole]);

  useEffect(() => {
    const filtered = leaves.filter(leave =>
      leave.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.leave_type.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLeaves(filtered);
  }, [searchQuery, leaves]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('leaves')
        .select('*, profiles!leaves_employee_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      if (userRole === 'employee') {
        query = query.eq('employee_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeaves(data || []);
      setFilteredLeaves(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch leaves');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    setFormData({
      leave_type: 'vacation',
      start_date: '',
      end_date: '',
      reason: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.start_date || !formData.end_date || !formData.reason) {
        toast.error('Please fill in all fields');
        return;
      }

      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      const daysCount = differenceInDays(endDate, startDate) + 1;

      if (daysCount <= 0) {
        toast.error('End date must be after start date');
        return;
      }

      const { error } = await supabase.from('leaves').insert({
        employee_id: user?.id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days_count: daysCount,
        reason: formData.reason,
        status: 'pending',
      } as any);

      if (error) throw error;

      // Log activity
      await supabase.rpc('log_activity', {
        p_user_id: user?.id,
        p_action: 'applied',
        p_entity_type: 'leave',
        p_entity_id: null,
        p_description: `Applied for ${daysCount} days of ${formData.leave_type} leave`,
      });

      toast.success('Leave application submitted successfully');
      setIsDialogOpen(false);
      fetchLeaves();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit leave application');
      console.error(error);
    }
  };

  const handleStatusUpdate = async (leaveId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('leaves')
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', leaveId);

      if (error) throw error;

      toast.success(`Leave ${newStatus} successfully`);
      fetchLeaves();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update leave status');
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            {userRole === 'admin' ? 'Review and manage leave requests' : 'Apply and track your leave requests'}
          </p>
        </div>
        <Button onClick={handleApply}>
          <Plus className="h-4 w-4 mr-2" />
          Apply for Leave
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leaves..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {userRole === 'admin' && <TableHead>Employee</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    {userRole === 'admin' && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={userRole === 'admin' ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No leave requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeaves.map((leave) => (
                      <TableRow key={leave.id}>
                        {userRole === 'admin' && (
                          <TableCell className="font-medium">{leave.profiles?.full_name || 'Unknown'}</TableCell>
                        )}
                        <TableCell className="capitalize">{leave.leave_type}</TableCell>
                        <TableCell>{format(new Date(leave.start_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(leave.end_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{leave.days_count}</TableCell>
                        <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        {userRole === 'admin' && (
                          <TableCell className="text-right">
                            {leave.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleStatusUpdate(leave.id, 'approved')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleStatusUpdate(leave.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a new leave request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave_type">Leave Type</Label>
              <Select
                value={formData.leave_type}
                onValueChange={(value) => setFormData({ ...formData, leave_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="personal">Personal Leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please provide a reason for your leave..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
