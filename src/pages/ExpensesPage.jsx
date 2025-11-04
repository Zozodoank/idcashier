import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHPP } from '@/contexts/HPPContext'; // Add HPP context
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Search, Folder, Download } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { expensesAPI, expenseCategoriesAPI } from '@/lib/api';
import * as XLSX from 'xlsx';

const ExpensesPage = ({ user }) => {
  const { t } = useLanguage();
  const { token } = useAuth();
  const { hppEnabled } = useHPP(); // Use HPP context
  const { toast } = useToast();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null
  });

  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState(null);
  
  // Form states
  const [expenseForm, setExpenseForm] = useState({
    date: new Date(),
    time: format(new Date(), 'HH:mm'),
    expense_type: '',
    category_id: null,
    amount: '',
    notes: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: ''
  });

  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    applyFilters();
  }, [expenses, searchQuery, selectedCategory, dateRange]);

  const fetchData = async () => {
    if (!token) return;
    
    try {
      const [expensesData, categoriesData] = await Promise.all([
        expensesAPI.getAll(token),
        expenseCategoriesAPI.getAll(token)
      ]);
      
      setExpenses(expensesData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const applyFilters = () => {
    let filtered = [...expenses];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.expense_type.toLowerCase().includes(query) ||
        expense.notes?.toLowerCase().includes(query) ||
        expense.category?.name?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category_id === selectedCategory);
    }

    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        
        if (dateRange.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          return expenseDate >= from && expenseDate <= to;
        }
        
        return expenseDate >= from;
      });
    }

    setFilteredExpenses(filtered);
  };

  const calculateTotal = () => {
    return filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleAddExpense = () => {
    setCurrentExpense(null);
    setExpenseForm({
      date: new Date(),
      time: format(new Date(), 'HH:mm'),
      expense_type: '',
      category_id: null,
      amount: '',
      notes: ''
    });
    setIsExpenseDialogOpen(true);
  };

  const handleEditExpense = (expense) => {
    const expenseDate = new Date(expense.date);
    setCurrentExpense(expense);
    setExpenseForm({
      date: expenseDate,
      time: format(expenseDate, 'HH:mm'),
      expense_type: expense.expense_type,
      category_id: expense.category_id,
      amount: expense.amount,
      notes: expense.notes || ''
    });
    setIsExpenseDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.expense_type || !expenseForm.amount) {
      toast({
        title: t('error'),
        description: 'Jenis Pengeluaran dan Harga harus diisi',
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(expenseForm.amount) <= 0) {
      toast({
        title: t('error'),
        description: 'Harga harus lebih dari 0',
        variant: "destructive"
      });
      return;
    }

    try {
      // Combine date and time
      const [hours, minutes] = expenseForm.time.split(':');
      const combinedDate = new Date(expenseForm.date);
      combinedDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const expenseData = {
        date: combinedDate.toISOString(),
        expense_type: expenseForm.expense_type,
        category_id: expenseForm.category_id || null,
        amount: parseFloat(expenseForm.amount),
        notes: expenseForm.notes
      };

      if (currentExpense) {
        await expensesAPI.update(currentExpense.id, expenseData, token);
        toast({
          title: t('success'),
          description: t('expenseSaved')
        });
      } else {
        await expensesAPI.create(expenseData, token);
        toast({
          title: t('success'),
          description: t('expenseSaved')
        });
      }

      setIsExpenseDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm(t('confirmDeleteExpense'))) return;

    try {
      await expensesAPI.delete(expenseId, token);
      toast({
        title: t('success'),
        description: t('expenseDeleted')
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleAddCategory = async () => {
    if (!categoryForm.name) {
      toast({
        title: t('error'),
        description: 'Nama kategori harus diisi',
        variant: "destructive"
      });
      return;
    }

    try {
      await expenseCategoriesAPI.create({ name: categoryForm.name }, token);
      toast({
        title: t('success'),
        description: t('categorySaved')
      });
      setCategoryForm({ name: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Hapus kategori ini?')) return;

    try {
      await expenseCategoriesAPI.delete(categoryId, token);
      toast({
        title: t('success'),
        description: 'Kategori berhasil dihapus'
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      toast({
        title: t('error'),
        description: 'Tidak ada data pengeluaran untuk di-export',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredExpenses.map((expense, index) => ({
        'No': index + 1,
        'Nomor Pengeluaran': expense.expense_number || '-',
        'Tanggal': format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        'Jam': expense.expense_time || '-',
        'Jenis Pengeluaran': expense.expense_type || '-',
        'Kategori': expense.category?.name || '-',
        'Jumlah': expense.amount || 0,
        'Catatan': expense.notes || '-'
      }));

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pengeluaran');

      // Set column widths
      const columnWidths = [
        { wch: 5 },  // No
        { wch: 20 }, // Nomor Pengeluaran
        { wch: 12 }, // Tanggal
        { wch: 8 },  // Jam
        { wch: 25 }, // Jenis Pengeluaran
        { wch: 20 }, // Kategori
        { wch: 15 }, // Jumlah
        { wch: 30 }  // Catatan
      ];
      worksheet['!cols'] = columnWidths;

      // Generate filename with date
      const fileName = `pengeluaran-${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, fileName);

      toast({
        title: t('success'),
        description: `Data berhasil di-export (${filteredExpenses.length} pengeluaran)`
      });
    } catch (error) {
      console.error('Error exporting expenses:', error);
      toast({
        title: t('error'),
        description: 'Gagal export data',
        variant: 'destructive'
      });
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: t('error'),
          description: 'File Excel kosong',
          variant: "destructive"
        });
        setIsImporting(false);
        return;
      }

      // Validate columns
      const requiredColumns = ['Tanggal', 'Jenis Pengeluaran', 'Harga'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        toast({
          title: t('error'),
          description: `Kolom yang diperlukan: ${missingColumns.join(', ')}`,
          variant: "destructive"
        });
        setIsImporting(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          // Parse date - support multiple formats
          let expenseDate;
          const dateStr = row['Tanggal'];
          
          if (typeof dateStr === 'number') {
            // Excel serial date
            expenseDate = new Date((dateStr - 25569) * 86400 * 1000);
          } else if (typeof dateStr === 'string') {
            // Try parsing as string (dd/MM/yyyy or yyyy-MM-dd)
            const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
            if (parts.length === 3) {
              if (dateStr.includes('/')) {
                // dd/MM/yyyy format
                expenseDate = new Date(parts[2], parts[1] - 1, parts[0]);
              } else {
                // yyyy-MM-dd format
                expenseDate = new Date(parts[0], parts[1] - 1, parts[2]);
              }
            } else {
              expenseDate = new Date(dateStr);
            }
          } else {
            expenseDate = new Date();
          }

          // Find or create category
          let categoryId = null;
          const categoryName = row['Kategori'];
          if (categoryName) {
            let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (!category) {
              // Create new category
              category = await expenseCategoriesAPI.create({ name: categoryName }, token);
            }
            categoryId = category.id;
          }

          // Parse amount
          let amount = row['Harga'];
          if (typeof amount === 'string') {
            // Remove currency symbols and thousand separators
            amount = amount.replace(/[Rp.\s]/g, '').replace(/,/g, '');
          }
          amount = parseFloat(amount);

          if (isNaN(amount) || amount <= 0) {
            errorCount++;
            continue;
          }

          // Create expense
          await expensesAPI.create({
            date: expenseDate.toISOString(),
            expense_type: row['Jenis Pengeluaran'] || 'Pengeluaran',
            category_id: categoryId,
            amount: amount,
            notes: row['Keterangan'] || ''
          }, token);

          successCount++;
        } catch (error) {
          console.error('Error importing row:', error);
          errorCount++;
        }
      }

      toast({
        title: t('success'),
        description: `Berhasil import ${successCount} pengeluaran${errorCount > 0 ? `, ${errorCount} gagal` : ''}`
      });

      // Refresh data and categories
      await fetchData();
      
    } catch (error) {
      console.error('Error importing file:', error);
      toast({
        title: t('error'),
        description: `${t('failedReadExcel')} ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('expenses')} - idCashier</title>
        <meta name="description" content={t('expenseManagement')} />
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('expenses')}</h1>
            <p className="text-muted-foreground">{t('expenseManagement')}</p>
          </div>
          <Card className="w-full sm:w-auto">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('totalExpenses')}</p>
                <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCategoryDialogOpen(true)}
          >
            <Folder className="w-4 h-4 mr-2" />
            {t('addCategory')}
          </Button>
          <Button onClick={handleAddExpense}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addExpense')}
          </Button>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Date Range and Category Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>{t('dateRange')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd MMM yyyy")} -{" "}
                            {format(dateRange.to, "dd MMM yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd MMM yyyy")
                        )
                      ) : (
                        <span>{t('selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                    <div className="p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({ from: null, to: null })}
                        className="w-full"
                      >
                        {t('clear')}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>{t('expenseCategory')}</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allCategories') || 'Semua Kategori'}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 items-end">
                <label htmlFor="import-expenses-file" className="flex-1">
                  <Button
                    variant="outline"
                    asChild
                    disabled={isImporting}
                  >
                    <span>
                      <Download className="w-4 h-4 mr-2" />
                      {isImporting ? t('importing') || 'Mengimpor...' : t('import')}
                    </span>
                  </Button>
                  <input
                    id="import-expenses-file"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImport}
                    disabled={isImporting}
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="flex-1"
                  disabled={filteredExpenses.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('exportToExcel')}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchExpense')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('expenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('noExpenses')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">{t('expenseNumber')}</th>
                      <th className="text-left p-3">{t('expenseDate')}</th>
                      <th className="text-left p-3">{t('expenseType')}</th>
                      <th className="text-left p-3">{t('expenseCategory')}</th>
                      <th className="text-right p-3">{t('expenseAmount')}</th>
                      <th className="text-left p-3">{t('expenseNotes')}</th>
                      <th className="text-center p-3">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, index) => (
                      <tr key={expense.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3">
                          {format(new Date(expense.date), 'dd MMM yyyy HH:mm')}
                        </td>
                        <td className="p-3">{expense.expense_type}</td>
                        <td className="p-3">{expense.category?.name || '-'}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {expense.notes || '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentExpense ? t('editExpense') : t('addExpense')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('expenseDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(expenseForm.date, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={expenseForm.date}
                      onSelect={(date) => setExpenseForm({ ...expenseForm, date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t('time')}</Label>
                <Input
                  type="time"
                  value={expenseForm.time}
                  onChange={(e) => setExpenseForm({ ...expenseForm, time: e.target.value })}
                />
              </div>
            </div>

            {/* Expense Type */}
            <div className="space-y-2">
              <Label>{t('expenseType')}</Label>
              <Input
                placeholder={t('expenseType')}
                value={expenseForm.expense_type}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>{t('expenseCategory')}</Label>
              <Select
                value={expenseForm.category_id || 'none'}
                onValueChange={(value) => setExpenseForm({
                  ...expenseForm,
                  category_id: value === 'none' ? null : value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>{t('expenseAmount')}</Label>
              <Input
                type="number"
                placeholder="0"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('expenseNotes')}</Label>
              <Textarea
                placeholder={t('expenseNotes')}
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveExpense}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('manageCategories')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add Category */}
            <div className="flex gap-2">
              <Input
                placeholder={t('categoryName')}
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
              />
              <Button onClick={handleAddCategory}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Category List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Belum ada kategori
                </p>
              ) : (
                categories.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span>{category.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCategoryDialogOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExpensesPage;

