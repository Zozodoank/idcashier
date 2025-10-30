import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Plus, Upload, Download, Edit, Trash2 } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { productsAPI, categoriesAPI, suppliersAPI, settingsAPI, productHPPBreakdownAPI, rawMaterialsAPI, productRecipesAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import HPPBreakdownInput from '@/components/HPPBreakdownInput';
import RawMaterialsManagement from '@/components/RawMaterialsManagement';
import RecipeInput from '@/components/RecipeInput';

const ProductsPage = ({ user }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: authUser, token } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Will store full category objects
  const [suppliers, setSuppliers] = useState([]); // Will store full supplier objects
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);

  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  const isDemoAccount = user.email === 'demo@gmail.com';
  
  // HPP feature state
  const [hppEnabled, setHppEnabled] = useState(false);
  const canViewHPP = user?.permissions?.canViewHPP || false;
  const [hppBreakdown, setHppBreakdown] = useState([]);
  
  // Recipe and Raw Materials state
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // Profit share configuration
  const [profitShareMode, setProfitShareMode] = useState('automatic');
  
  // Loading state for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    loadHPPSetting();
    loadProfitShareConfig();
  }, [authUser]);

  const loadHPPSetting = async () => {
    if (!token) return;
    
    try {
      const setting = await settingsAPI.get('hpp_enabled', token);
      if (setting && setting.setting_value && setting.setting_value.enabled) {
        setHppEnabled(true);
      }
    } catch (error) {
      console.error('Error loading HPP setting:', error);
      // If error, default to false (feature disabled)
      setHppEnabled(false);
    }
  };

  const loadProfitShareConfig = async () => {
    if (!token) return;
    
    try {
      const config = await settingsAPI.get('profit_share_config', token);
      if (config && config.setting_value && config.setting_value.mode) {
        setProfitShareMode(config.setting_value.mode);
      }
    } catch (error) {
      console.log('No profit share config found, using default (automatic)');
      setProfitShareMode('automatic');
    }
  };

  const fetchData = async () => {
    if (!authUser || !token) return;
    
    try {
      // Fetch products using the API
      const productsData = await productsAPI.getAll(token);
      
      // Transform products data to include category and supplier names directly
      const transformedProducts = productsData.map(product => ({
        ...product,
        category: product.category_name || '',
        supplier: product.supplier_name || ''
      }));
      
      setProducts(transformedProducts);
      
      // Fetch categories and suppliers from backend APIs
      try {
        const categoriesData = await categoriesAPI.getAll(token);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // For demo account, if no categories exist, add some demo data
        if (isDemoAccount) {
          setCategories([
            { id: '1', name: 'Kopi', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
            { id: '2', name: 'Pastry', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]);
        } else {
          setCategories([]);
        }
      }
      
      try {
        const suppliersData = await suppliersAPI.getAll(token);
        setSuppliers(suppliersData);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        // For demo account, if no suppliers exist, add some demo data
        if (isDemoAccount) {
          setSuppliers([
            { id: '1', name: 'Supplier A', address: 'Jl. Kopi No. 1', phone: '08123456789', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
            { id: '2', name: 'Supplier B', address: 'Jl. Kue No. 2', phone: '08987654321', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]);
        } else {
          setSuppliers([]);
        }
      }
      
      // Fetch raw materials
      try {
        const rawMaterialsData = await rawMaterialsAPI.getAll(token);
        console.log('Raw materials fetched:', rawMaterialsData?.length || 0, 'items');
        setRawMaterials(rawMaterialsData || []);
      } catch (error) {
        console.error('Error fetching raw materials:', error);
        setRawMaterials([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('error'), description: `${t('failedLoadData')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleProductSubmit = async () => {
    // Prevent double submission
    if (isSubmitting) {
      console.log('Submission already in progress, ignoring...');
      return;
    }

    if (!currentProduct.name || !currentProduct.price || !currentProduct.cost) {
      toast({ title: t('error'), description: t('priceCostRequired'), variant: "destructive" });
      return;
    }
    
    try {
      setIsSubmitting(true);
      // Prepare product data - ONLY include valid DB fields
      const productData = {
        name: currentProduct.name,
        barcode: currentProduct.barcode || '',
        price: parseFloat(currentProduct.price),
        cost: parseFloat(currentProduct.cost),
        stock: parseInt(currentProduct.stock) || 0,
        profit_share_enabled: currentProduct.profit_share_enabled || false,
        profit_share_type: currentProduct.profit_share_type || null,
        profit_share_value: currentProduct.profit_share_value || 0
      };
      
      // Calculate total HPP from recipes if enabled
      if (hppEnabled) {
        // Calculate from recipes if exists
        const totalHPPFromRecipe = recipes.reduce((sum, recipe) => {
          if (!recipe.raw_material_id || !recipe.quantity) return sum;
          const material = rawMaterials.find(m => m.id === recipe.raw_material_id);
          const pricePerUnit = material ? parseFloat(material.price_per_unit) : 0;
          const quantity = parseFloat(recipe.quantity) || 0;
          return sum + (pricePerUnit * quantity);
        }, 0);
        
        // Calculate from HPP breakdown if exists (fallback for old system)
        const totalHPPFromBreakdown = hppBreakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        
        // Use recipe HPP if exists, otherwise use breakdown HPP, otherwise use cost
        productData.hpp = totalHPPFromRecipe > 0 
          ? totalHPPFromRecipe 
          : (totalHPPFromBreakdown > 0 ? totalHPPFromBreakdown : parseFloat(currentProduct.cost) || 0);
      }
      
      // Only include category_id if it's not null/empty
      if (currentProduct.category_id) {
        productData.category_id = currentProduct.category_id;
      }
      
      // Only include supplier_id if it's not null/empty
      if (currentProduct.supplier_id) {
        productData.supplier_id = currentProduct.supplier_id;
      }
      
      // Filter valid recipes (must have material and quantity)
      const validRecipes = recipes.filter(r => r.raw_material_id && r.quantity && parseFloat(r.quantity) > 0);
      
      console.log('Saving product with recipes:', validRecipes.length, validRecipes);

      let savedProduct;
      if (currentProduct.id) {
        // Update existing product
        savedProduct = await productsAPI.update(currentProduct.id, productData, token);
        
        // Save recipes if enabled
        if (hppEnabled && user?.permissions?.canEditHPP) {
          await productRecipesAPI.save(currentProduct.id, validRecipes, token);
          // Also save HPP breakdown for backward compatibility
          await productHPPBreakdownAPI.save(currentProduct.id, hppBreakdown, token);
        }
        
        toast({ title: t('success'), description: t('productUpdated') });
      } else {
        // Create new product
        savedProduct = await productsAPI.create(productData, token);
        
        // Save recipes if enabled and product was created
        if (hppEnabled && user?.permissions?.canEditHPP && savedProduct && savedProduct.id) {
          await productRecipesAPI.save(savedProduct.id, validRecipes, token);
          // Also save HPP breakdown for backward compatibility
          await productHPPBreakdownAPI.save(savedProduct.id, hppBreakdown, token);
        }
        
        toast({ title: t('success'), description: t('productAdded') });
      }
      
      setIsProductDialogOpen(false);
      setCurrentProduct(null);
      setHppBreakdown([]);
      setRecipes([]);
      await fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: t('error'), description: `${t('failedSaveProduct')} ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = async (product) => {
    // Refresh raw materials data to ensure it's up to date
    if (rawMaterials.length === 0) {
      console.log('Raw materials empty, fetching data...');
      await fetchData();
    }
    
    // Find category ID by name
    let categoryId = null;
    if (product.category) {
      const category = categories.find(cat => cat.name === product.category);
      if (category) {
        categoryId = category.id;
      }
    }
    
    // Find supplier ID by name
    let supplierId = null;
    if (product.supplier) {
      const supplier = suppliers.find(sup => sup.name === product.supplier);
      if (supplier) {
        supplierId = supplier.id;
      }
    }
    
    setCurrentProduct({
      ...product,
      category_id: categoryId,
      supplier_id: supplierId
    });
    
    // Load recipes and HPP breakdown if enabled and product exists
    if (hppEnabled && product.id && user?.permissions?.canViewHPP) {
      try {
        // Load recipes
        const recipeData = await productRecipesAPI.getByProduct(product.id, token);
        console.log('Loaded recipes for product:', recipeData?.length || 0);
        setRecipes(recipeData || []);
        
        // Load HPP breakdown (for backward compatibility)
        const breakdown = await productHPPBreakdownAPI.getByProduct(product.id, token);
        setHppBreakdown(breakdown || []);
      } catch (error) {
        console.error('Error loading recipes/HPP breakdown:', error);
        setRecipes([]);
        setHppBreakdown([]);
      }
    } else {
      setRecipes([]);
      setHppBreakdown([]);
    }
    
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(t('confirmDeleteProduct'))) return;
    
    try {
      await productsAPI.delete(productId, token);
      toast({ title: t('deleted'), description: t('productDeleted') });
      await fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: t('error'), description: `${t('failedDeleteProduct')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleAddProduct = async () => {
    console.log('Opening add product dialog, rawMaterials count:', rawMaterials.length);
    
    // Refresh raw materials data to ensure it's up to date
    if (rawMaterials.length === 0) {
      console.log('Raw materials empty, fetching data...');
      await fetchData();
    }
    
    setCurrentProduct({
      name: '',
      category_id: null,
      supplier_id: null,
      price: '',
      cost: '',
      stock: 0,
      barcode: ''
    });
    setHppBreakdown([]);
    setRecipes([]);
    setIsProductDialogOpen(true);
  };

  // Helper function to get or create category
  const getOrCreateCategory = async (categoryName, token) => {
    try {
      // Check if category already exists in local state
      const existingCategory = categories.find(cat => cat.name === categoryName);
      if (existingCategory) {
        return existingCategory.id;
      }
      
      // Create new category if not found
      const newCategory = await categoriesAPI.create({ name: categoryName }, token);
      // Refresh categories to include the new one
      await fetchData();
      return newCategory.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  };

  // Helper function to get or create supplier
  const getOrCreateSupplier = async (supplierName, token) => {
    try {
      // Check if supplier already exists in local state
      const existingSupplier = suppliers.find(sup => sup.name === supplierName);
      if (existingSupplier) {
        return existingSupplier.id;
      }
      
      // Create new supplier if not found
      const newSupplier = await suppliersAPI.create({ 
        name: supplierName,
        address: '',
        phone: ''
      }, token);
      // Refresh suppliers to include the new one
      await fetchData();
      return newSupplier.id;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  };

  // Function to import products from Excel
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Process imported data with Promise.all to wait for all operations
        let successCount = 0;
        let errorCount = 0;
        
        const importPromises = jsonData.map(async (item) => {
          try {
            // Enhanced column mapping to support both Indonesian and English column names
            const name = item.Nama || item.nama || item.name || item.Name || '';
            const barcode = item.Barcode || item.barcode || '';
            const categoryName = item.Kategori || item.kategori || item.category || item.Category || '';
            const supplierName = item.Supplier || item.supplier || '';
            const price = item['Harga Jual'] || item.price || item.Price || 0;
            const cost = item['Harga Modal'] || item.cost || item.Cost || 0;
            const stock = item.Stock || item.stock || 0;
            
            // Get or create category
            let categoryId = null;
            if (categoryName) {
              categoryId = await getOrCreateCategory(categoryName, token);
            }
            
            // Get or create supplier
            let supplierId = null;
            if (supplierName) {
              supplierId = await getOrCreateSupplier(supplierName, token);
            }
            
            // Create product
            await productsAPI.create({
              name: name,
              category_id: categoryId,
              supplier_id: supplierId,
              price: parseFloat(price),
              cost: parseFloat(cost),
              stock: parseInt(stock),
              barcode: barcode
            }, token);
            
            successCount++;
            return { success: true };
          } catch (error) {
            console.error('Error importing product:', error);
            errorCount++;
            return { success: false, error: error.message };
          }
        });
        
        // Wait for all import operations to complete
        await Promise.all(importPromises);
        
        // Show result message
        if (errorCount === 0) {
          toast({ title: t('imported'), description: t('importSuccess') });
        } else {
          toast({ 
            title: t('imported'), 
            description: `${successCount} produk berhasil diimpor, ${errorCount} gagal` 
          });
        }
        
        // Refresh all data
        await fetchData();
      } catch (error) {
        console.error('Error reading Excel file:', error);
        toast({ title: t('error'), description: t('failedReadExcel'), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Function to export products to Excel
  const handleExport = () => {
    // Transform products data to include only required columns in the specified order
    const exportData = products.map(product => ({
      'Nama': product.name,
      'Barcode': product.barcode || '',
      'Kategori': product.category,
      'Supplier': product.supplier || '',
      'Harga Jual': product.price,
      'Harga Modal': product.cost,
      'Stock': product.stock
    }));
    
    exportToExcel(exportData, 'products');
    toast({ title: t('exported'), description: t('exportSuccess') });
  };

  // Generic delete function for product, category, or supplier
  const handleDelete = async (type, id) => {
    if (type === 'product') {
      handleDeleteProduct(id);
    } else if (type === 'category') {
      try {
        await categoriesAPI.delete(id, token);
        toast({ title: t('deleted'), description: t('categoryDeleted') });
        await fetchData(); // Refresh data
      } catch (error) {
        console.error('Error deleting category:', error);
        toast({ title: t('error'), description: `${t('failedDeleteCategory')} ${error.message}`, variant: "destructive" });
      }
    } else if (type === 'supplier') {
      try {
        await suppliersAPI.delete(id, token);
        toast({ title: t('deleted'), description: t('supplierDeleted') });
        await fetchData(); // Refresh data
      } catch (error) {
        console.error('Error deleting supplier:', error);
        toast({ title: t('error'), description: `${t('failedDeleteSupplier')} ${error.message}`, variant: "destructive" });
      }
    }
  };

  // Function to handle category submission (create/update)
  const handleCategorySubmit = async () => {
    if (!currentCategory.name) {
      toast({ title: t('error'), description: t('categoryRequired'), variant: "destructive" });
      return;
    }

    try {
      if (currentCategory.id) {
        // Update existing category
        await categoriesAPI.update(currentCategory.id, { name: currentCategory.name }, token);
        toast({ title: t('success'), description: t('categoryUpdated') });
      } else {
        // Create new category
        await categoriesAPI.create({ name: currentCategory.name }, token);
        toast({ title: t('success'), description: t('categoryAdded') });
      }

      setIsCategoryDialogOpen(false);
      setCurrentCategory(null);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving category:', error);
      toast({ title: t('error'), description: `${t('failedSaveCategory')} ${error.message}`, variant: "destructive" });
    }
  };

  // Function to handle supplier submission (create/update)
  const handleSupplierSubmit = async () => {
    if (!currentSupplier.name) {
      toast({ title: t('error'), description: t('supplierRequired'), variant: "destructive" });
      return;
    }

    // Prevent double submit
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const supplierData = {
        name: currentSupplier.name,
        address: currentSupplier.address || '',
        phone: currentSupplier.phone || ''
      };

      if (currentSupplier.id) {
        // Update existing supplier
        await suppliersAPI.update(currentSupplier.id, supplierData, token);
        toast({ title: t('success'), description: t('supplierUpdated') });
      } else {
        // Create new supplier
        await suppliersAPI.create(supplierData, token);
        toast({ title: t('success'), description: t('supplierAdded') });
      }

      setIsSupplierDialogOpen(false);
      setCurrentSupplier(null);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({ title: t('error'), description: `${t('failedSaveSupplier')} ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet><title>{t('products')} - idCashier</title></Helmet>
      <div className="space-y-6">
        <Tabs defaultValue="products">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t('products')}</h1>
              <p className="text-muted-foreground">{t('productsSubtitle')}</p>
            </div>
            <TabsList className="grid w-full sm:w-auto grid-cols-4">
              <TabsTrigger value="products">{t('products')}</TabsTrigger>
              <TabsTrigger value="categories">{t('category')}</TabsTrigger>
              <TabsTrigger value="suppliers">{t('supplier')}</TabsTrigger>
              <TabsTrigger value="raw-materials">{t('rawMaterials') || 'bahan baku'}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <Input placeholder={t('searchProduct')} className="max-w-sm" />
                <div className="flex gap-2">
                  <label htmlFor="import-file">
                    <Button variant="outline" asChild><span><Download className="w-4 h-4 mr-2" /> {t('import')}</span></Button>
                    <input 
                      id="import-file" 
                      type="file" 
                      accept=".xlsx,.xls" 
                      className="hidden" 
                      onChange={(e) => handleImport(e)} 
                    />
                  </label>
                  <Button variant="outline" onClick={handleExport}><Upload className="w-4 h-4 mr-2" /> {t('export')}</Button>
                  <Button onClick={handleAddProduct}><Plus className="w-4 h-4 mr-2" /> {t('addProduct')}</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-left">{t('productName')}</th>
                        <th className="p-3 text-left">{t('barcode')}</th>
                        <th className="p-3 text-left">{t('category')}</th>
                        <th className="p-3 text-left">{t('supplier')}</th>
                        <th className="p-3 text-left">{t('sellPrice')}</th>
                        <th className="p-3 text-left">{t('costPrice')}</th>
                        {hppEnabled && canViewHPP && (
                          <>
                            <th className="p-3 text-left">{t('hpp')}</th>
                            <th className="p-3 text-left">{t('profitMargin')}</th>
                          </>
                        )}
                        <th className="p-3 text-left">{t('stock')}</th>
                        <th className="p-3 text-left">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => {
                        // Calculate profit margin: ((price - hpp) / price) * 100
                        const hpp = p.hpp || p.cost || 0;
                        const profitMargin = p.price > 0 ? (((p.price - hpp) / p.price) * 100).toFixed(1) : 0;
                        
                        return (
                          <tr key={p.id} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{p.name}</td>
                            <td className="p-3">{p.barcode || '-'}</td>
                            <td className="p-3">{p.category}</td>
                            <td className="p-3">{p.supplier || '-'}</td>
                            <td className="p-3">Rp {p.price.toLocaleString()}</td>
                            <td className="p-3">Rp {p.cost.toLocaleString()}</td>
                            {hppEnabled && canViewHPP && (
                              <>
                                <td className="p-3">Rp {hpp.toLocaleString()}</td>
                                <td className="p-3">
                                  <span className={profitMargin >= 30 ? 'text-green-600 font-medium' : profitMargin >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                                    {profitMargin}%
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="p-3">{p.stock}</td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditProduct(p)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(p.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{t('categoryManagement')}</CardTitle><Button onClick={() => { setCurrentCategory({ name: '' }); setIsCategoryDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> {t('addCategory')}</Button></CardHeader>
              <CardContent>
                {categories.map(c => <div key={c.id} className="flex items-center justify-between p-3 border-b"><p>{c.name}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setCurrentCategory(c); setIsCategoryDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDelete('category', c.id)}><Trash2 className="w-4 h-4" /></Button></div></div>)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{t('supplierManagement')}</CardTitle><Button onClick={() => { setCurrentSupplier({ name: '', address: '', phone: '' }); setIsSupplierDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> {t('addSupplier')}</Button></CardHeader>
              <CardContent>
                {suppliers.map(s => <div key={s.id} className="flex items-center justify-between p-3 border-b"><div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.address} - {s.phone}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setCurrentSupplier(s); setIsSupplierDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDelete('supplier', s.id)}><Trash2 className="w-4 h-4" /></Button></div></div>)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw-materials">
            <RawMaterialsManagement />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{currentProduct?.id ? t('edit') : t('add')} {t('products')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label htmlFor="name">{t('productName')}</Label><Input id="name" value={currentProduct?.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} /></div>
          <div className="space-y-2"><Label htmlFor="barcode">{t('barcode')}</Label><Input id="barcode" value={currentProduct?.barcode || ''} onChange={e => setCurrentProduct({...currentProduct, barcode: e.target.value})} /></div>
          <div className="space-y-2"><Label htmlFor="category">{t('category')}</Label>
            <Select value={currentProduct?.category_id || ''} onValueChange={value => setCurrentProduct({...currentProduct, category_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="supplier">{t('supplier')}</Label>
            <Select value={currentProduct?.supplier_id || ''} onValueChange={value => setCurrentProduct({...currentProduct, supplier_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectSupplier')} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="price">{t('sellPrice')}</Label><Input id="price" type="number" value={currentProduct?.price || ''} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} /></div>
          <div className="space-y-2"><Label htmlFor="cost">{t('costPrice')}</Label><Input id="cost" type="number" value={currentProduct?.cost || ''} onChange={e => setCurrentProduct({...currentProduct, cost: Number(e.target.value)})} /></div>
          {hppEnabled && user?.permissions?.canEditHPP && (
            <>
              <RecipeInput
                recipe={recipes}
                setRecipe={setRecipes}
                rawMaterials={rawMaterials}
                readOnly={!user?.permissions?.canEditHPP}
              />
              <HPPBreakdownInput
                hppBreakdown={hppBreakdown}
                setHppBreakdown={setHppBreakdown}
                readOnly={!user?.permissions?.canEditHPP}
              />
              
              {/* Profit Share Section - Only show if mode is automatic */}
              {profitShareMode === 'automatic' && (
                <div className="space-y-4 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-purple-900 dark:text-purple-100">
                      {t('profitShareSettings')}
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="profit-share-enabled"
                      checked={currentProduct?.profit_share_enabled || false}
                      onCheckedChange={v => setCurrentProduct({...currentProduct, profit_share_enabled: v})}
                    />
                    <Label htmlFor="profit-share-enabled">{t('enableProfitShare')}</Label>
                  </div>
                  
                  {currentProduct?.profit_share_enabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-purple-200">
                      <div className="space-y-2">
                        <Label>{t('shareType')}</Label>
                        <Select 
                          value={currentProduct?.profit_share_type || 'percentage'} 
                          onValueChange={v => setCurrentProduct({...currentProduct, profit_share_type: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{t('percentage')} (%)</SelectItem>
                            <SelectItem value="fixed">{t('fixedAmount')} (Rp)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{t('shareValue')}</Label>
                        <Input 
                          type="number"
                          placeholder={currentProduct?.profit_share_type === 'percentage' ? '10' : '5000'}
                          value={currentProduct?.profit_share_value || ''}
                          onChange={e => setCurrentProduct({...currentProduct, profit_share_value: Number(e.target.value)})}
                        />
                        <p className="text-xs text-muted-foreground">
                          {currentProduct?.profit_share_type === 'percentage' 
                            ? 'Contoh: 10 = 10% dari harga jual'
                            : 'Contoh: 5000 = Rp 5.000 per item'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show message when manual mode is selected */}
              {profitShareMode === 'manual' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm border border-blue-200">
                  <span className="text-blue-900 dark:text-blue-100">
                    💡 Bagi hasil untuk produk ini diatur per karyawan di halaman Karyawan → Tab Bagi Hasil
                  </span>
                </div>
              )}
            </>
          )}
          <div className="space-y-2"><Label htmlFor="stock">{t('stock')}</Label><Input id="stock" type="number" value={currentProduct?.stock || ''} onChange={e => setCurrentProduct({...currentProduct, stock: Number(e.target.value)})} /></div>
        </div>
        <DialogFooter>
          <Button onClick={handleProductSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('saving') || 'Menyimpan...' : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}><DialogContent>
        <DialogHeader><DialogTitle>{currentCategory?.id ? t('edit') : t('add')} {t('category')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4"><div className="space-y-2"><Label htmlFor="cat-name">{t('category')}</Label><Input id="cat-name" value={currentCategory?.name || ''} onChange={e => setCurrentCategory({...currentCategory, name: e.target.value})} /></div></div>
        <DialogFooter><Button onClick={handleCategorySubmit}>{t('save')}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}><DialogContent>
        <DialogHeader><DialogTitle>{currentSupplier?.id ? t('edit') : t('add')} {t('supplier')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label htmlFor="sup-name">{t('supplier')}</Label><Input id="sup-name" value={currentSupplier?.name || ''} onChange={e => setCurrentSupplier({...currentSupplier, name: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="sup-address">{t('address')}</Label><Input id="sup-address" value={currentSupplier?.address || ''} onChange={e => setCurrentSupplier({...currentSupplier, address: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="sup-phone">{t('phone')}</Label><Input id="sup-phone" value={currentSupplier?.phone || ''} onChange={e => setCurrentSupplier({...currentSupplier, phone: e.target.value})} /></div>
        </div>
        <DialogFooter><Button onClick={handleSupplierSubmit}>{t('save')}</Button></DialogFooter>
      </DialogContent></Dialog>
    </>
  );
};

export default ProductsPage;