import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, CheckCircle, XCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

const AttendancePage = ({ user }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Dialogs
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  
  // Forms
  const [attendanceForm, setAttendanceForm] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    clock_in: '',
    clock_out: '',
    status: 'present',
    notes: ''
  });
  
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '',
    leave_type: 'sick',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
    affects_salary: false,
    affects_profit_share: false
  });

  useEffect(() => {
    fetchEmployees();
    fetchAttendance();
    fetchLeaveRequests();
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('employee_attendance')
        .select(`
          *,
          employees!inner(id, name, tenant_id)
        `)
        .eq('employees.tenant_id', tenantId)
        .eq('attendance_date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('employee_leave_requests')
        .select(`
          *,
          employees!inner(id, name, tenant_id)
        `)
        .eq('employees.tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      if (!attendanceForm.employee_id) {
        toast({
          title: t('error'),
          description: 'Please select an employee',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('employee_attendance')
        .upsert({
          employee_id: attendanceForm.employee_id,
          attendance_date: attendanceForm.attendance_date,
          clock_in: attendanceForm.clock_in || null,
          clock_out: attendanceForm.clock_out || null,
          status: attendanceForm.status,
          notes: attendanceForm.notes
        }, {
          onConflict: 'employee_id,attendance_date'
        });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('attendanceSaved')
      });

      setAttendanceDialogOpen(false);
      fetchAttendance();
      resetAttendanceForm();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSubmitLeave = async () => {
    try {
      if (!leaveForm.employee_id) {
        toast({
          title: t('error'),
          description: 'Please select an employee',
          variant: 'destructive'
        });
        return;
      }

      // Calculate total days
      const startDate = new Date(leaveForm.start_date);
      const endDate = new Date(leaveForm.end_date);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase
        .from('employee_leave_requests')
        .insert({
          employee_id: leaveForm.employee_id,
          leave_type: leaveForm.leave_type,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          total_days: totalDays,
          reason: leaveForm.reason,
          affects_salary: leaveForm.affects_salary,
          affects_profit_share: leaveForm.affects_profit_share,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('leaveSaved')
      });

      setLeaveDialogOpen(false);
      fetchLeaveRequests();
      resetLeaveForm();
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleApproveLeave = async (leaveId) => {
    if (!confirm(t('confirmApproveLeave'))) return;

    try {
      // Call the database function to approve leave
      const { error } = await supabase.rpc('approve_leave_request', {
        p_leave_id: leaveId,
        p_approved_by: authUser.id
      });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('leaveApproved')
      });

      fetchLeaveRequests();
      fetchAttendance();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!confirm(t('confirmRejectLeave'))) return;

    try {
      const { error } = await supabase
        .from('employee_leave_requests')
        .update({
          status: 'rejected',
          approved_by: authUser.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('leaveRejected')
      });

      fetchLeaveRequests();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetAttendanceForm = () => {
    setAttendanceForm({
      employee_id: '',
      attendance_date: new Date().toISOString().split('T')[0],
      clock_in: '',
      clock_out: '',
      status: 'present',
      notes: ''
    });
  };

  const resetLeaveForm = () => {
    setLeaveForm({
      employee_id: '',
      leave_type: 'sick',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: '',
      affects_salary: false,
      affects_profit_share: false
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      present: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      absent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      late: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      half_day: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      leave: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
    };
    return colors[status] || '';
  };

  const getLeaveStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
    };
    return colors[status] || '';
  };

  return (
    <>
      <Helmet>
        <title>{t('attendanceManagement')} - idCashier</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('attendanceManagement')}</h1>
          <p className="text-muted-foreground">{t('attendanceManagementDesc')}</p>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance">
              <Calendar className="w-4 h-4 mr-2" />
              {t('attendance')}
            </TabsTrigger>
            <TabsTrigger value="leave">
              <FileText className="w-4 h-4 mr-2" />
              {t('leaveRequests')}
            </TabsTrigger>
          </TabsList>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('attendance')}</CardTitle>
                    <CardDescription>Track daily attendance</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                    />
                    <Button onClick={() => setAttendanceDialogOpen(true)}>
                      <Clock className="w-4 h-4 mr-2" />
                      Mark Attendance
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : attendance.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('noAttendance')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attendance.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold">{record.employees?.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {record.clock_in && (
                              <span>In: {format(new Date(record.clock_in), 'HH:mm')}</span>
                            )}
                            {record.clock_out && (
                              <span>Out: {format(new Date(record.clock_out), 'HH:mm')}</span>
                            )}
                            {record.notes && <span>• {record.notes}</span>}
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(record.status)}`}>
                          {t(record.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEAVE REQUESTS TAB */}
          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('leaveRequests')}</CardTitle>
                    <CardDescription>Manage employee leave requests</CardDescription>
                  </div>
                  <Button onClick={() => setLeaveDialogOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    {t('requestLeave')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leaveRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('noLeaveRequests')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{request.employees?.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLeaveStatusColor(request.status)}`}>
                              {t(request.status)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">{t(request.leave_type + 'Leave') || request.leave_type}</span>
                            {' • '}
                            {format(new Date(request.start_date), 'dd MMM yyyy')} - {format(new Date(request.end_date), 'dd MMM yyyy')}
                            {' • '}
                            {request.total_days} {t('totalDays')}
                          </p>
                          {request.reason && (
                            <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>
                          )}
                        </div>
                        {request.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleApproveLeave(request.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {t('approveLeave')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleRejectLeave(request.id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {t('rejectLeave')}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Mark Attendance */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={attendanceForm.employee_id}
                onValueChange={(v) => setAttendanceForm({ ...attendanceForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('attendanceDate')}</Label>
              <Input
                type="date"
                value={attendanceForm.attendance_date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('clockIn')}</Label>
                <Input
                  type="time"
                  value={attendanceForm.clock_in}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, clock_in: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('clockOut')}</Label>
                <Input
                  type="time"
                  value={attendanceForm.clock_out}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, clock_out: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('attendanceStatus')}</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={(v) => setAttendanceForm({ ...attendanceForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">{t('present')}</SelectItem>
                  <SelectItem value="absent">{t('absent')}</SelectItem>
                  <SelectItem value="late">{t('late')}</SelectItem>
                  <SelectItem value="half_day">{t('halfDay')}</SelectItem>
                  <SelectItem value="leave">{t('leave')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={attendanceForm.notes}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveAttendance}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Request Leave */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('requestLeave')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={leaveForm.employee_id}
                onValueChange={(v) => setLeaveForm({ ...leaveForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('leaveType')}</Label>
              <Select
                value={leaveForm.leave_type}
                onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick">{t('sickLeave')}</SelectItem>
                  <SelectItem value="annual">{t('annualLeave')}</SelectItem>
                  <SelectItem value="unpaid">{t('unpaidLeave')}</SelectItem>
                  <SelectItem value="emergency">{t('emergencyLeave')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Reason for leave..."
                rows={3}
              />
            </div>

            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="affects-salary">{t('affectsSalary')}</Label>
                <Switch
                  id="affects-salary"
                  checked={leaveForm.affects_salary}
                  onCheckedChange={(v) => setLeaveForm({ ...leaveForm, affects_salary: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="affects-profit">{t('affectsProfitShare')}</Label>
                <Switch
                  id="affects-profit"
                  checked={leaveForm.affects_profit_share}
                  onCheckedChange={(v) => setLeaveForm({ ...leaveForm, affects_profit_share: v })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmitLeave}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttendancePage;

