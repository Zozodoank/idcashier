import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, Edit, Trash2, Users as UsersIcon, DollarSign, X, Download, Calendar, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { usersAPI } from '@/lib/api';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Permission presets untuk kasir
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
  const [profitShareMode, setProfitShareMode] = useState('automatic'); // 'automatic' or 'manual'
  const [profitShareBasis, setProfitShareBasis] = useState('revenue'); // 'revenue' or 'net_profit'
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
      
      // Note: user_id in employees references auth.users, not public.users
      // So we can't join directly - fetch employees without the join
      // We'll use employee.email directly instead of trying to join with users
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map employees and add empty users object to prevent errors when accessing employee.users
      const employeesWithUsers = (data || []).map(emp => ({
        ...emp,
        users: null // Set to null since we can't join with auth.users
      }));
      
      setEmployees(employeesWithUsers);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: t('error'),
        description: 'Failed to load employees',
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

  // Load profit share configuration from app_settings
  const loadProfitShareConfig = async () => {
    try {
      const userId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      // Use maybeSingle() instead of single() to handle cases where no row exists
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

  // Save profit share configuration
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
        description: t('saveConfiguration') + ' berhasil'
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

  // Fetch all product shares (for profit share tab)
  const fetchAllProductShares = async () => {
    try {
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      
      if (!tenantId) {
        console.error('No tenant ID available');
        return;
      }
      
      // First, get all employee IDs for this tenant
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId);
      
      if (empError) {
        console.error('Error fetching employees for product shares:', empError);
        throw empError;
      }
      
      const employeeIds = (employees || []).map(emp => emp.id);
      
      if (employeeIds.length === 0) {
        setAllProductShares([]);
        return;
      }
      
      // Then fetch product shares for those employees
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

  // Export product shares to Excel
  const exportProductSharesToExcel = () => {
    if (allProductShares.length === 0) {
      toast({
        title: t('error'),
        description: 'Tidak ada data untuk di-export',
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
      description: 'Data berhasil di-export'
    });
  };

  // Attendance Functions
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
        email: employee.email || '', // Use employee.email directly since we removed the join
        base_salary: employee.base_salary || 0,
        is_active: employee.is_active,
        has_app_access: !!employee.user_id,
        password: '',
        permission_preset: 'cashier' // Default to cashier since we can't access user permissions without join
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
          description: 'Employee name is required',
          variant: 'destructive'
        });
        return;
      }

      // Validate email and password if has_app_access is true
      if (formData.has_app_access) {
        if (!formData.email) {
          toast({
            title: t('error'),
            description: 'Email diperlukan untuk karyawan dengan akses aplikasi',
            variant: 'destructive'
          });
          return;
        }
        if (!currentEmployee && !formData.password) {
          toast({
            title: t('error'),
            description: 'Password diperlukan untuk akun baru',
            variant: 'destructive'
          });
          return;
        }
        if (formData.password && formData.password.length < 6) {
          toast({
            title: t('error'),
            description: 'Password minimal 6 karakter',
            variant: 'destructive'
          });
          return;
        }
      }

      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      let userId = currentEmployee?.user_id || null;
      
      if (currentEmployee) {
        // Update existing employee
        
        // If toggling app access on
        if (formData.has_app_access && !currentEmployee.user_id) {
          // Create user account
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
        // If has app access and updating
        else if (formData.has_app_access && currentEmployee.user_id) {
          // Update user account
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
        // If toggling app access off
        else if (!formData.has_app_access && currentEmployee.user_id) {
          // Delete user account
          await usersAPI.delete(currentEmployee.user_id, token);
          userId = null;
        }
        
        // Update employee record
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
        // Create new employee
        
        // If has app access, create user first
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
        
        // Create employee record
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

  // Profit Share Functions
  const handleOpenProfitShareDialog = async (employee) => {
    setSelectedEmployee(employee);
    setProfitShareDialogOpen(true);
    
    // Fetch existing profit shares for this employee
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
    if (!newShare.product_id || newShare.share_value <= 0) {
      toast({
        title: t('error'),
        description: 'Pilih produk dan masukkan nilai bagi hasil',
        variant: 'destructive'
      });
      return;
    }

    // Check if this product already has a share for this employee
    const existing = employeeProductShares.find(s => s.product_id === newShare.product_id);
    if (existing) {
      toast({
        title: t('error'),
        description: 'Produk ini sudah memiliki bagi hasil',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employee_product_shares')
        .insert({
          employee_id: selectedEmployee.id,
          product_id: newShare.product_id,
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

      toast({
        title: t('success'),
        description: 'Bagi hasil produk ditambahkan'
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
        description: 'Bagi hasil produk dihapus'
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

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('employeeManagement')}</h1>
          <p className="text-muted-foreground">{t('employeeManagementDesc')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="employees">{t('employees')}</TabsTrigger>
            <TabsTrigger value="profit-share">{t('profitShare')}</TabsTrigger>
            <TabsTrigger value="attendance">{t('attendance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t('totalBaseSalary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {totalBaseSalary.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Per bulan</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t('activeEmployee')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeEmployeeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">dari {employees.length} karyawan</p>
            </CardContent>
          </Card>
        </div>

        {/* Employee List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('employees')}</CardTitle>
                <CardDescription>Daftar karyawan dan gaji pokok</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                {t('addEmployee')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('noEmployees')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map(employee => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{employee.name}</h3>
                        {employee.is_active && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Aktif
                          </span>
                        )}
                        {employee.user_id && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {t('employeeWithAccess')}
                          </span>
                        )}
                      </div>
                      {employee.email && (
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      )}
                      <p className="text-sm font-medium mt-1">
                        Gaji Pokok: Rp {(employee.base_salary || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenProfitShareDialog(employee)}
                        title="Konfigurasi Bagi Hasil"
                      >
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(employee)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(employee.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="profit-share" className="space-y-6">
            {/* Konfigurasi Mode Distribusi */}
            <Card>
              <CardHeader>
                <CardTitle>{t('profitShareMode')}</CardTitle>
                <CardDescription>{t('profitShareNote')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-base font-semibold mb-3 block">{t('profitShareMode')}</Label>
                  <RadioGroup value={profitShareMode} onValueChange={setProfitShareMode}>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="automatic" id="automatic" />
                      <Label htmlFor="automatic" className="font-normal cursor-pointer">
                        {t('automaticDistribution')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="font-normal cursor-pointer">
                        {t('manualDistribution')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {profitShareMode === 'automatic' && (
                  <div className="pl-6 space-y-4 border-l-2 border-purple-200">
                    <div>
                      <Label className="text-base font-semibold mb-3 block">{t('profitShareBasis')}</Label>
                      <RadioGroup value={profitShareBasis} onValueChange={setProfitShareBasis}>
                        <div className="flex items-center space-x-2 mb-2">
                          <RadioGroupItem value="revenue" id="revenue" />
                          <Label htmlFor="revenue" className="font-normal cursor-pointer">
                            {t('revenue')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="net_profit" id="net_profit" />
                          <Label htmlFor="net_profit" className="font-normal cursor-pointer">
                            {t('netProfit')}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        💡 {t('automaticProfitShareNote')} {profitShareBasis === 'revenue' ? t('revenue').toLowerCase() : t('netProfit').toLowerCase()}
                      </p>
                    </div>
                  </div>
                )}

                {profitShareMode === 'manual' && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      💡 {t('manualProfitShareNote')}
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={saveProfitShareConfig}>
                    {t('saveConfiguration')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* List Produk dengan Bagi Hasil Manual */}
            {profitShareMode === 'manual' && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{t('productShareList')}</CardTitle>
                      <CardDescription>Daftar produk dengan konfigurasi bagi hasil manual</CardDescription>
                    </div>
                    <Button onClick={exportProductSharesToExcel} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      {t('exportToExcel')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {allProductShares.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-muted/20">
                      <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground mb-4">{t('noProductSharesYet')}</p>
                      <p className="text-sm text-muted-foreground">
                        Gunakan tombol <DollarSign className="w-4 h-4 inline" /> di halaman karyawan untuk mengatur bagi hasil per produk
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">{t('product')}</th>
                            <th className="text-left p-3 font-medium">{t('employeeName')}</th>
                            <th className="text-left p-3 font-medium">{t('shareType')}</th>
                            <th className="text-right p-3 font-medium">Nilai</th>
                            <th className="text-center p-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allProductShares.map((share) => (
                            <tr key={share.id} className="border-b hover:bg-muted/50">
                              <td className="p-3">{share.product?.name || '-'}</td>
                              <td className="p-3">{share.employee?.name || '-'}</td>
                              <td className="p-3">
                                {share.share_type === 'percentage' ? t('percentage') : t('fixedAmount')}
                              </td>
                              <td className="p-3 text-right">
                                {share.share_type === 'percentage' 
                                  ? `${share.share_value}%` 
                                  : `Rp ${share.share_value?.toLocaleString()}`}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                  share.employee?.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {share.employee?.is_active ? 'Aktif' : 'Tidak Aktif'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="space-y-6">
            <Tabs defaultValue="attendance-records" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="attendance-records">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t('attendance')}
                </TabsTrigger>
                <TabsTrigger value="leave">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('leaveRequests')}
                </TabsTrigger>
              </TabsList>

              {/* ATTENDANCE RECORDS SUB-TAB */}
              <TabsContent value="attendance-records" className="space-y-4">
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
                        <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
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
                                  <span>In: {record.clock_in}</span>
                                )}
                                {record.clock_out && (
                                  <span>Out: {record.clock_out}</span>
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

              {/* LEAVE REQUESTS SUB-TAB */}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Mark Attendance */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>Record employee attendance for the selected date</DialogDescription>
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
            <DialogDescription>Submit a leave request for an employee</DialogDescription>
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

      {/* Dialog for Add/Edit Employee */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentEmployee ? t('editEmployee') : t('addEmployee')}
            </DialogTitle>
            <DialogDescription>
              {currentEmployee ? 'Update employee information' : 'Add a new employee to your team'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('employeeName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama lengkap karyawan"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="base_salary">{t('baseSalary')}</Label>
              <Input
                id="base_salary"
                type="number"
                value={formData.base_salary}
                onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="is_active">{t('activeEmployee')}</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={v => setFormData({ ...formData, is_active: v })}
              />
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/20">
              <div>
                <Label htmlFor="has_app_access">{t('hasAppAccess')}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Karyawan dapat login dan mengakses aplikasi
                  {user?.email === 'demo@gmail.com' && (
                    <span className="text-amber-600 font-medium"> (Data akan dihapus saat reset demo)</span>
                  )}
                </p>
              </div>
              <Switch
                id="has_app_access"
                checked={formData.has_app_access}
                onCheckedChange={v => setFormData({ ...formData, has_app_access: v })}
              />
            </div>
            
            {formData.has_app_access && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('employeeEmail')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {t('password')} {currentEmployee ? '(opsional)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder={currentEmployee ? 'Kosongkan jika tidak ingin mengubah' : 'Minimal 6 karakter'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="permission_preset">{t('permissionPreset')}</Label>
                  <Select
                    value={formData.permission_preset}
                    onValueChange={v => setFormData({ ...formData, permission_preset: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view_only">{t('viewOnly')}</SelectItem>
                      <SelectItem value="cashier">{t('cashier')}</SelectItem>
                      <SelectItem value="manager">{t('manager')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.permission_preset === 'view_only' && 'Hanya dapat melihat penjualan dan laporan'}
                    {formData.permission_preset === 'cashier' && 'Dapat melakukan penjualan, mengelola produk, dan melihat laporan'}
                    {formData.permission_preset === 'manager' && 'Akses penuh termasuk hapus produk dan transaksi'}
                  </p>
                </div>
              </>
            )}
            
            {!formData.has_app_access && formData.email && (
              <div className="space-y-2">
                <Label htmlFor="email_optional">{t('employeeEmail')} (opsional)</Label>
                <Input
                  id="email_optional"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Profit Share Configuration */}
      <Dialog open={profitShareDialogOpen} onOpenChange={setProfitShareDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('profitShareSettings')} - {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription>Configure product-specific profit sharing for this employee</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Add New Product Share */}
            <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/20">
              <h3 className="font-semibold mb-3">Tambah Bagi Hasil Produk</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-1">
                  <Label>Produk</Label>
                  <Select 
                    value={newShare.product_id} 
                    onValueChange={v => setNewShare({...newShare, product_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Tipe</Label>
                  <Select 
                    value={newShare.share_type} 
                    onValueChange={v => setNewShare({...newShare, share_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Persentase (%)</SelectItem>
                      <SelectItem value="fixed">Tetap (Rp)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Nilai</Label>
                  <Input 
                    type="number"
                    placeholder={newShare.share_type === 'percentage' ? '10' : '5000'}
                    value={newShare.share_value || ''}
                    onChange={e => setNewShare({...newShare, share_value: Number(e.target.value)})}
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={handleAddProductShare} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah
                  </Button>
                </div>
              </div>
            </div>

            {/* List of Current Product Shares */}
            <div>
              <h3 className="font-semibold mb-3">Bagi Hasil Aktif</h3>
              {employeeProductShares.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-muted-foreground">
                    Belum ada bagi hasil untuk karyawan ini
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {employeeProductShares.map(share => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{share.products?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {share.share_type === 'percentage' 
                            ? `${share.share_value}% dari harga jual` 
                            : `Rp ${share.share_value.toLocaleString()} per item`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteProductShare(share.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 <strong>Catatan:</strong> Bagi hasil yang dikonfigurasi di sini akan 
                diutamakan dibanding pengaturan default di produk. Jika produk tidak ada 
                di list ini, sistem akan menggunakan pengaturan default produk (jika ada).
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setProfitShareDialogOpen(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeesPage;

