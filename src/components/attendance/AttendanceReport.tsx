import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { EmployeeAttendance } from '@/types/attendance';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export const AttendanceReport: React.FC = () => {
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchAttendance();
  }, [page, startDate, endDate]);

  useEffect(() => {
    if (!realtimeEnabled) return;

    // Subscribe to attendance_logs inserts
    const channel = supabase
      .channel('attendance-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs'
        },
        (payload) => {
          console.log('New attendance log:', payload);
          // Refresh data
          fetchAttendance();
          toast({
            title: 'New Attendance',
            description: 'Attendance record updated from device'
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [realtimeEnabled]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('employee_attendance')
        .select(`
          *,
          employees(id, name, email)
        `, { count: 'exact' })
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Apply filters
      if (startDate) {
        query = query.gte('attendance_date', startDate);
      }
      if (endDate) {
        query = query.lte('attendance_date', endDate);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setAttendance(data || []);
      setHasMore(count ? count > (page + 1) * PAGE_SIZE : false);
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setPage(0);
    fetchAttendance();
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    try {
      return format(new Date(timestamp), 'HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd MMM yyyy');
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
          <CardDescription>View employee attendance synced from devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleRefresh} className="w-full">
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="realtime"
                checked={realtimeEnabled}
                onCheckedChange={setRealtimeEnabled}
              />
              <Label htmlFor="realtime" className="cursor-pointer">
                Enable Realtime Updates
              </Label>
            </div>
            {realtimeEnabled && (
              <span className="text-xs text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : attendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No attendance records found
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Employee</th>
                      <th className="text-left p-3 font-medium">Clock In</th>
                      <th className="text-left p-3 font-medium">Clock Out</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{formatDate(record.attendance_date)}</td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{record.employees?.name}</p>
                            {record.employees?.email && (
                              <p className="text-xs text-muted-foreground">
                                {record.employees.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={record.clock_in ? '' : 'text-muted-foreground'}>
                            {formatTime(record.clock_in)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={record.clock_out ? '' : 'text-muted-foreground'}>
                            {formatTime(record.clock_out)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              record.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : record.status === 'absent'
                                ? 'bg-red-100 text-red-800'
                                : record.status === 'leave'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {record.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {page + 1} • Showing {attendance.length} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={!hasMore}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

