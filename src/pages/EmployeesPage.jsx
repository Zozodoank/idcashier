import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHPP } from '@/contexts/HPPContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Users as UsersIcon, DollarSign, X, Download, Calendar, Clock, CheckCircle, XCircle, FileText, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { usersAPI, attendanceMachinesAPI } from '@/lib/api';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const PERMISSION_PRESETS = {
  view_only: {
    sales: true,
    products: false,
    reports: true,
    canEditProduct: false,
    canDeleteProduct: false,
    canAddProduct: false,
    canImportProduct: false,
    canAddCustomer: false,
    canAddSupplier: false,
    canApplyDiscount: false,
    canApplyTax: false,
    canDeleteTransaction: false,
    canExportReports: false
  },
  cashier: {
    sales: true,
    products: true,
    reports: true,
    canEditProduct: true,
    canDeleteProduct: false,
    canAddProduct: true,
    canImportProduct: true,
    canAddCustomer: true,
    canAddSupplier: true,
    canApplyDiscount: true,
    canApplyTax: true,
    canDeleteTransaction: false,
    canExportReports: true
  },
  manager: {
    sales: true,
    products: true,
    reports: true,
    canEditProduct: true,
    canDeleteProduct: true,
    canAddProduct: true,
    canImportProduct: true,
    canAddCustomer: true,
    canAddSupplier: true,
    canApplyDiscount: true,
    canApplyTax: true,
    canDeleteTransaction: true,
    canExportReports: true
  }
};

const EmployeesPage = ({ user }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: authUser, token } = useAuth();
  const { hppEnabled } = useHPP();
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    base_salary: 0,
    is_active: true,
    has_app_access: false,
    password: '',
    permission_preset: 'cashier'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Profit share configuration
  const [profitShareDialogOpen, setProfitShareDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [products, setProducts] = useState([]);
  const [employeeProductShares, setEmployeeProductShares] = useState([]);
  const [newShare, setNewShare] = useState({
    product_id: '',
    share_type: 'percentage',
    share_value: 0
  });

  // Profit share system configuration
  const [profitShareMode, setProfitShareMode] = useState('automatic');
  const [profitShareBasis, setProfitShareBasis] = useState('revenue');
  const [allProductShares, setAllProductShares] = useState([]);
  const [activeTab, setActiveTab] = useState('employees');

  // Attendance states
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
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

  // Machine State
  const [machines, setMachines] = useState([]);
  const [isMachineDialogOpen, setIsMachineDialogOpen] = useState(false);
  const [currentMachine, setCurrentMachine] = useState({ name: '', ip_address: '', port: '4370', status: 'active' });

  useEffect(() => {
    fetchEmployees();
    fetchProducts();
    loadProfitShareConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'profit-share') {
      fetchAllProductShares();
    } else if (activeTab === 'attendance') {
      fetchAttendance();
      fetchLeaveRequests();
      fetchMachines();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const employeesWithUsers = (data || []).map(emp => ({
        ...emp,
        users: null
      }));
      
      setEmployees(employeesWithUsers);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: t('error'),
        description: t('failedLoadData'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('user_id', tenantId)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const loadProfitShareConfig = async () => {
    try {
      const userId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('user_id', userId)
        .eq('setting_key', 'profit_share_config')
        .maybeSingle();

      if (data && data.setting_value) {
        setProfitShareMode(data.setting_value.mode || 'automatic');
        setProfitShareBasis(data.setting_value.basis || 'revenue');
      }
    } catch (error) {
      console.log('No profit share config found, using defaults');
    }
  };

  const saveProfitShareConfig = async () => {
    try {
      const userId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      const config = {
        mode: profitShareMode,
        basis: profitShareBasis
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          user_id: userId,
          setting_key: 'profit_share_config',
          setting_value: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,setting_key'
        });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('saveConfigurationSuccessful')
      });
    } catch (error) {
      console.error('Error saving profit share config:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const fetchAllProductShares = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      if (!tenantId) return;
      
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId);
      
      if (empError) throw empError;
      
      const employeeIds = (employees || []).map(emp => emp.id);
      
      if (employeeIds.length === 0) {
        setAllProductShares([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('employee_product_shares')
        .select(`
          *,
          employee:employees(id, name, is_active),
          product:products(id, name)
        `)
        .in('employee_id', employeeIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllProductShares(data || []);
    } catch (error) {
      console.error('Error fetching all product shares:', error);
    }
  };

  const exportProductSharesToExcel = () => {
    if (allProductShares.length === 0) {
      toast({
        title: t('error'),
        description: t('noDataToExport'),
        variant: 'destructive'
      });
      return;
    }

    const exportData = allProductShares.map(share => ({
      'Nama Produk': share.product?.name || '-',
      'Nama Karyawan': share.employee?.name || '-',
      'Tipe Bagi Hasil': share.share_type === 'percentage' ? 'Persentase' : 'Nilai Tetap',
      'Nilai': share.share_value,
      'Status Karyawan': share.employee?.is_active ? 'Aktif' : 'Tidak Aktif'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bagi Hasil Produk');

    const fileName = `bagi-hasil-produk-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: t('success'),
      description: t('exportSuccess')
    });
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

  const fetchMachines = async () => {
    try {
      const data = await attendanceMachinesAPI.getAll(token);
      setMachines(data);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      if (!attendanceForm.employee_id) {
        toast({
          title: t('error'),
          description: t('selectEmployee'),
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
          description: t('selectEmployee'),
          variant: 'destructive'
        });
        return;
      }

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

  const handleSaveMachine = async () => {
    try {
      if (currentMachine.id) {
        await attendanceMachinesAPI.update(currentMachine.id, currentMachine, token);
        toast({ title: t('success'), description: t('machineUpdated') });
      } else {
        await attendanceMachinesAPI.create(currentMachine, token);
        toast({ title: t('success'), description: t('machineAdded') });
      }
      setIsMachineDialogOpen(false);
      fetchMachines();
    } catch (error) {
      console.error('Error saving machine:', error);
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteMachine = async (id) => {
    if (!window.confirm(t('confirmDeleteMachine'))) return;
    try {
      await attendanceMachinesAPI.delete(id, token);
      toast({ title: t('success'), description: t('machineDeleted') });
      fetchMachines();
    } catch (error) {
      console.error('Error deleting machine:', error);
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const openMachineDialog = (machine = null) => {
    if (machine) {
      setCurrentMachine(machine);
    } else {
      setCurrentMachine({ name: '', ip_address: '', port: '4370', status: 'active' });
    }
    setIsMachineDialogOpen(true);
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

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setCurrentEmployee(employee);
      setFormData({
        name: employee.name,
        email: employee.email || '',
        base_salary: employee.base_salary || 0,
        is_active: employee.is_active,
        has_app_access: !!employee.user_id,
        password: '',
        permission_preset: 'cashier'
      });
    } else {
      setCurrentEmployee(null);
      setFormData({
        name: '',
        email: '',
        base_salary: 0,
        is_active: true,
        has_app_access: false,
        password: '',
        permission_preset: 'cashier'
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast({
          title: t('error'),
          description: t('nameRequired'),
          variant: 'destructive'
        });
        return;
      }

      if (formData.has_app_access) {
        if (!formData.email) {
          toast({
            title: t('error'),
            description: t('emailRequiredForAppAccess'),
            variant: 'destructive'
          });
          return;
        }
        if ((!currentEmployee || !currentEmployee.user_id) && !formData.password) {
          toast({
            title: t('error'),
            description: t('passwordRequired'),
            variant: 'destructive'
          });
          return;
        }
        if (formData.password && formData.password.length < 6) {
          toast({
            title: t('error'),
            description: t('passwordMinLength'),
            variant: 'destructive'
          });
          return;
        }
      }

      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      let userId = currentEmployee?.user_id || null;
      
      if (currentEmployee) {
        if (formData.has_app_access && !currentEmployee.user_id) {
          const cashierData = {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'cashier',
            tenant_id: tenantId,
            permissions: PERMISSION_PRESETS[formData.permission_preset]
          };
          
          const createdUser = await usersAPI.create(cashierData, token);
          userId = createdUser.id;
        } 
        else if (formData.has_app_access && currentEmployee.user_id) {
          const updateData = {
            name: formData.name,
            email: formData.email,
            permissions: PERMISSION_PRESETS[formData.permission_preset]
          };
          
          if (formData.password) {
            updateData.password = formData.password;
          }
          
          await usersAPI.update(currentEmployee.user_id, updateData, token);
        }
        else if (!formData.has_app_access && currentEmployee.user_id) {
          await usersAPI.delete(currentEmployee.user_id, token);
          userId = null;
        }
        
        const { error } = await supabase
          .from('employees')
          .update({
            name: formData.name,
            email: formData.has_app_access ? formData.email : (formData.email || null),
            base_salary: formData.base_salary,
            is_active: formData.is_active,
            user_id: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentEmployee.id);

        if (error) throw error;
      } else {
        if (formData.has_app_access) {
          const cashierData = {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'cashier',
            tenant_id: tenantId,
            permissions: PERMISSION_PRESETS[formData.permission_preset]
          };
          
          const createdUser = await usersAPI.create(cashierData, token);
          userId = createdUser.id;
        }
        
        const { error } = await supabase
          .from('employees')
          .insert({
            tenant_id: tenantId,
            name: formData.name,
            email: formData.has_app_access ? formData.email : (formData.email || null),
            base_salary: formData.base_salary,
            is_active: formData.is_active,
            user_id: userId
          });

        if (error) throw error;
      }

      toast({
        title: t('success'),
        description: t('employeeSaved')
      });

      setDialogOpen(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (employeeId) => {
    if (!confirm(t('confirmDeleteEmployee'))) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('employeeDeleted')
      });

      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleOpenProfitShareDialog = async (employee) => {
    setSelectedEmployee(employee);
    setProfitShareDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('employee_product_shares')
        .select(`
          id,
          product_id,
          share_type,
          share_value,
          products(id, name, price)
        `)
        .eq('employee_id', employee.id);

      if (error) throw error;
      setEmployeeProductShares(data || []);
    } catch (error) {
      console.error('Error fetching employee product shares:', error);
    }
  };

  const handleAddProductShare = async () => {
    if (newShare.share_value <= 0) {
      toast({
        title: t('error'),
        description: t('valueMustBePositive'),
        variant: 'destructive'
      });
      return;
    }

    const productIdToSave = newShare.product_id === 'ALL_PRODUCTS' ? null : newShare.product_id;

    const existing = employeeProductShares.find(s => s.product_id === productIdToSave);
    if (existing) {
      toast({
        title: t('error'),
        description: t('productAlreadyHasShare'),
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employee_product_shares')
        .insert({
          employee_id: selectedEmployee.id,
          product_id: productIdToSave,
          share_type: newShare.share_type,
          share_value: newShare.share_value
        })
        .select(`
          id,
          product_id,
          share_type,
          share_value,
          products(id, name, price)
        `)
        .single();

      if (error) throw error;

      setEmployeeProductShares([...employeeProductShares, data]);
      setNewShare({
        product_id: '',
        share_type: 'percentage',
        share_value: 0
      });
      setProfitShareDialogOpen(false);

      toast({
        title: t('success'),
        description: t('productShareAdded')
      });
    } catch (error) {
      console.error('Error adding product share:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteProductShare = async (shareId) => {
    try {
      const { error } = await supabase
        .from('employee_product_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      setEmployeeProductShares(employeeProductShares.filter(s => s.id !== shareId));

      toast({
        title: t('success'),
        description: t('productShareDeleted')
      });
    } catch (error) {
      console.error('Error deleting product share:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const totalBaseSalary = employees
    .filter(emp => emp.is_active)
    .reduce((sum, emp) => sum + (emp.base_salary || 0), 0);

  const activeEmployeeCount = employees.filter(emp => emp.is_active).length;

  return (
    <>
      <Helmet>
        <title>{t('employees')} - idCashier</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('employeeManagement')}</h1>
            <p className="text-muted-foreground">{t('employeeManagementDesc')}</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addEmployee')}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="employees">{t('employees')}</TabsTrigger>
            {hppEnabled && <TabsTrigger value="profit-share">{t('profitShare')}</TabsTrigger>}
            <TabsTrigger value="attendance">{t('attendance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
                      <tr>
                        <th className="px-6 py-3">{t('employeeName')}</th>
                        <th className="px-6 py-3">{t('status')}</th>
                        <th className="px-6 py-3 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(employee => (
                        <tr key={employee.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{employee.name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {employee.is_active ? t('active') : t('inactive')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenDialog(employee)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(employee.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {hppEnabled && (
            <TabsContent value="profit-share" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Employee List */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('employees')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-y-auto max-h-[600px]">
                      {employees.map(emp => (
                        <div 
                          key={emp.id}
                          onClick={() => handleOpenProfitShareDialog(emp)}
                          className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedEmployee?.id === emp.id ? 'bg-muted border-l-4 border-l-primary' : ''}`}
                        >
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-sm text-muted-foreground">{emp.is_active ? t('active') : t('inactive')}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Profit Share Settings */}
                <Card className="md:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t('profitShareSettings')}</CardTitle>
                      <CardDescription>
                        {selectedEmployee ? t('profitShareConfigurationFor') + ' ' + selectedEmployee.name : t('selectEmployeeToConfigure')}
                      </CardDescription>
                    </div>
                    {selectedEmployee && (
                      <Button size="sm" onClick={() => setProfitShareDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('addRule') || 'Tambah Aturan'}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedEmployee ? (
                      <div className="space-y-4">
                        {employeeProductShares.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>{t('noProfitShareRules')}</p>
                            <Button variant="link" onClick={() => setProfitShareDialogOpen(true)}>
                              {t('addFirstRule') || 'Tambah Aturan Pertama'}
                            </Button>
                          </div>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
                                <tr>
                                  <th className="px-4 py-3">{t('product')}</th>
                                  <th className="px-4 py-3">{t('shareType')}</th>
                                  <th className="px-4 py-3 text-right">{t('value')}</th>
                                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {employeeProductShares.map(share => (
                                  <tr key={share.id} className="bg-white dark:bg-gray-900 border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-3 font-medium">
                                      {share.product ? share.product.name : (t('allProducts') || 'Semua Produk')}
                                    </td>
                                    <td className="px-4 py-3">
                                      {share.share_type === 'percentage' ? (t('percentage') || 'Persentase') : (t('fixedAmount') || 'Nilai Tetap')}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {share.share_type === 'percentage' 
                                        ? `${share.share_value}%` 
                                        : `Rp ${share.share_value.toLocaleString()}`}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteProductShare(share.id)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        <UsersIcon className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t('selectEmployeeLeft') || t('selectEmployeeLeft')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          <TabsContent value="attendance" className="space-y-4">
             <Tabs defaultValue="log">
                <TabsList>
                  <TabsTrigger value="log">{t('attendance')}</TabsTrigger>
                  <TabsTrigger value="leave">{t('leaveRequests')}</TabsTrigger>
                  <TabsTrigger value="machines">{t('attendanceMachines')}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="log" className="space-y-4">
                  {/* Attendance Log */}
                  <div className="flex justify-end">
                    <Button onClick={() => setAttendanceDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('markAttendance')}
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      {/* Attendance Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
                            <tr>
                              <th className="px-6 py-3">{t('employeeName')}</th>
                              <th className="px-6 py-3">{t('clockIn')}</th>
                              <th className="px-6 py-3">{t('clockOut')}</th>
                              <th className="px-6 py-3">{t('status')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendance.map(record => (
                              <tr key={record.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4">{record.employees?.name}</td>
                                <td className="px-6 py-4">{record.clock_in || '-'}</td>
                                <td className="px-6 py-4">{record.clock_out || '-'}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(record.status)}`}>
                                    {t(record.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="leave" className="space-y-4">
                  {/* Leave Requests */}
                  <div className="flex justify-end">
                    <Button onClick={() => setLeaveDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('requestLeave')}
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
                            <tr>
                              <th className="px-6 py-3">{t('employeeName')}</th>
                              <th className="px-6 py-3">{t('leaveType')}</th>
                              <th className="px-6 py-3">{t('startDate')}</th>
                              <th className="px-6 py-3">{t('endDate')}</th>
                              <th className="px-6 py-3">{t('status')}</th>
                              <th className="px-6 py-3 text-right">{t('actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveRequests.map(request => (
                              <tr key={request.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4">{request.employees?.name}</td>
                                <td className="px-6 py-4">{t(request.leave_type)}</td>
                                <td className="px-6 py-4">{request.start_date}</td>
                                <td className="px-6 py-4">{request.end_date}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${getLeaveStatusColor(request.status)}`}>
                                    {t(request.status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  {request.status === 'pending' && (
                                    <>
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveLeave(request.id)}>
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleRejectLeave(request.id)}>
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="machines" className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={() => openMachineDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('addMachine')}
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
                            <tr>
                              <th className="px-6 py-3">{t('machineName')}</th>
                              <th className="px-6 py-3">{t('machineIp')}</th>
                              <th className="px-6 py-3">{t('machinePort')}</th>
                              <th className="px-6 py-3">{t('status')}</th>
                              <th className="px-6 py-3 text-right">{t('actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {machines.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-muted-foreground">
                                  {t('noMachines')}
                                </td>
                              </tr>
                            ) : (
                              machines.map(machine => (
                                <tr key={machine.id} className="bg-white border-b hover:bg-gray-50">
                                  <td className="px-6 py-4">{machine.name}</td>
                                  <td className="px-6 py-4">{machine.ip_address}</td>
                                  <td className="px-6 py-4">{machine.port}</td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${machine.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                      {t(machine.status)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => openMachineDialog(machine)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteMachine(machine.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
             </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{currentEmployee ? t('editEmployee') : t('addEmployee')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('name')}</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="has_app_access" 
                checked={formData.has_app_access}
                onCheckedChange={(checked) => setFormData({...formData, has_app_access: checked})}
              />
              <Label htmlFor="has_app_access">{t('grantAppAccess')}</Label>
            </div>

            {formData.has_app_access && (
              <>
                <div>
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  />
                </div>
                {(!currentEmployee || !currentEmployee.user_id) && (
                  <div>
                    <Label htmlFor="password">{t('password')}</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"}
                        value={formData.password} 
                        onChange={(e) => setFormData({...formData, password: e.target.value})} 
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Role</Label>
                  <Select 
                    value={formData.permission_preset}
                    onValueChange={(value) => setFormData({...formData, permission_preset: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view_only">View Only</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="base_salary">{t('baseSalary')}</Label>
              <Input 
                id="base_salary" 
                type="number"
                value={formData.base_salary} 
                onChange={(e) => setFormData({...formData, base_salary: parseFloat(e.target.value)})} 
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="is_active" 
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active">{t('active')}</Label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('markAttendance')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('employeeName')}</Label>
              <Select 
                value={attendanceForm.employee_id} 
                onValueChange={(value) => setAttendanceForm({...attendanceForm, employee_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectEmployee')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.is_active).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('clockIn')}</Label>
                <Input 
                  type="time" 
                  value={attendanceForm.clock_in} 
                  onChange={(e) => setAttendanceForm({...attendanceForm, clock_in: e.target.value})}
                />
              </div>
              <div>
                <Label>{t('clockOut')}</Label>
                <Input 
                  type="time" 
                  value={attendanceForm.clock_out} 
                  onChange={(e) => setAttendanceForm({...attendanceForm, clock_out: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>{t('status')}</Label>
              <Select 
                value={attendanceForm.status} 
                onValueChange={(value) => setAttendanceForm({...attendanceForm, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">{t('present')}</SelectItem>
                  <SelectItem value="absent">{t('absent')}</SelectItem>
                  <SelectItem value="late">{t('late')}</SelectItem>
                  <SelectItem value="half_day">{t('halfDay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Textarea 
                value={attendanceForm.notes} 
                onChange={(e) => setAttendanceForm({...attendanceForm, notes: e.target.value})}
                placeholder={t('optionalNotes')}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveAttendance}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('requestLeave')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('employeeName')}</Label>
              <Select 
                value={leaveForm.employee_id} 
                onValueChange={(value) => setLeaveForm({...leaveForm, employee_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectEmployee')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.is_active).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('leaveType')}</Label>
              <Select 
                value={leaveForm.leave_type} 
                onValueChange={(value) => setLeaveForm({...leaveForm, leave_type: value})}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('startDate')}</Label>
                <Input 
                  type="date" 
                  value={leaveForm.start_date} 
                  onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})}
                />
              </div>
              <div>
                <Label>{t('endDate')}</Label>
                <Input 
                  type="date" 
                  value={leaveForm.end_date} 
                  onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>{t('reason')}</Label>
              <Textarea 
                value={leaveForm.reason} 
                onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmitLeave}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profit Share Rule Dialog */}
      <Dialog open={profitShareDialogOpen} onOpenChange={setProfitShareDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('addProfitShareRule') || 'Tambah Aturan Bagi Hasil'}</DialogTitle>
            <DialogDescription>
              {t('configureProfitShareFor').replace('{name}', selectedEmployee?.name || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('product')}</Label>
              <Select 
                value={newShare.product_id || 'ALL_PRODUCTS'} 
                onValueChange={(value) => setNewShare({...newShare, product_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectProduct')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_PRODUCTS">{t('allProducts') || 'Semua Produk'}</SelectItem>
                  {products.map(prod => (
                    <SelectItem key={prod.id} value={prod.id}>{prod.name} - Rp {(prod.price || 0).toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('shareType')}</Label>
              <RadioGroup 
                value={newShare.share_type} 
                onValueChange={(value) => setNewShare({...newShare, share_type: value})}
                className="flex flex-row gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="ps-percentage" />
                  <Label htmlFor="ps-percentage">{t('percentage') || 'Persentase'}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="ps-fixed" />
                  <Label htmlFor="ps-fixed">{t('fixedAmount') || 'Nilai Tetap'}</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>{t('value')}</Label>
              <div className="relative mt-1">
                {newShare.share_type === 'fixed' && (
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                )}
                <Input 
                  type="number" 
                  value={newShare.share_value} 
                  onChange={(e) => setNewShare({...newShare, share_value: parseFloat(e.target.value)})}
                  className={newShare.share_type === 'fixed' ? 'pl-10' : ''}
                  placeholder="0"
                />
                {newShare.share_type === 'percentage' && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newShare.share_type === 'percentage' 
                  ? 'Contoh: 10% dari harga jual' 
                  : 'Contoh: Rp 5.000 per produk terjual'}
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAddProductShare}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Machine Dialog */}
      <Dialog open={isMachineDialogOpen} onOpenChange={setIsMachineDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{currentMachine.id ? t('machineName') : t('addMachine')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('machineName')}</Label>
              <Input 
                value={currentMachine.name} 
                onChange={(e) => setCurrentMachine({...currentMachine, name: e.target.value})} 
                placeholder="Contoh: Mesin Lantai 1"
              />
            </div>
            <div>
              <Label>{t('machineIp')}</Label>
              <Input 
                value={currentMachine.ip_address} 
                onChange={(e) => setCurrentMachine({...currentMachine, ip_address: e.target.value})} 
                placeholder="192.168.1.201"
              />
            </div>
            <div>
              <Label>{t('machinePort')}</Label>
              <Input 
                value={currentMachine.port} 
                onChange={(e) => setCurrentMachine({...currentMachine, port: e.target.value})} 
                placeholder="4370"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveMachine}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeesPage;
