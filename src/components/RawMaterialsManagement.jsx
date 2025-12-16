import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { rawMaterialsAPI } from '@/lib/api';

const RawMaterialsManagement = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { token } = useAuth();
  
  const [materials, setMaterials] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format stock to remove unnecessary decimals
  const formatStock = (stock) => {
    const num = parseFloat(stock);
    // If integer, show without decimals
    if (Number.isInteger(num)) {
      return num.toString();
    }
    // If has decimals, show up to 3 decimals but remove trailing zeros
    return num.toFixed(3).replace(/\.?0+$/, '');
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const data = await rawMaterialsAPI.getAll(token);
      setMaterials(data);
    } catch (error) {
      console.error('Error fetching raw materials:', error);
      toast({ 
        title: t('error'), 
        description: error.message || t('failedLoadData'), 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setCurrentMaterial({
      name: '',
      unit: '',
      price_per_unit: 0,
      stock: 0
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (material) => {
    setCurrentMaterial({ ...material });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(t('confirmDeleteRawMaterial').replace('{name}', name))) return;
    
    try {
      await rawMaterialsAPI.delete(id, token);
      toast({ 
        title: t('success'), 
        description: t('rawMaterialDeleted') 
      });
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting raw material:', error);
      toast({ 
        title: t('error'), 
        description: error.message || t('failedDeleteRawMaterial'), 
        variant: 'destructive' 
      });
    }
  };

  const handleSubmit = async () => {
    if (!currentMaterial.name || !currentMaterial.unit) {
      toast({ 
        title: t('error'), 
        description: t('nameUnitRequired'), 
        variant: 'destructive' 
      });
      return;
    }

    // Prevent multiple submits
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const materialData = {
        name: currentMaterial.name,
        unit: currentMaterial.unit,
        price_per_unit: parseFloat(currentMaterial.price_per_unit) || 0,
        stock: parseFloat(currentMaterial.stock) || 0
      };

      if (currentMaterial.id) {
        await rawMaterialsAPI.update(currentMaterial.id, materialData, token);
        toast({ title: t('success'), description: t('rawMaterialUpdated') });
      } else {
        await rawMaterialsAPI.create(materialData, token);
        toast({ title: t('success'), description: t('rawMaterialAdded') });
      }

      setIsDialogOpen(false);
      setCurrentMaterial(null);
      await fetchMaterials();
    } catch (error) {
      console.error('Error saving raw material:', error);
      toast({ 
        title: t('error'), 
        description: error.message || t('failedSaveRawMaterial'), 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('rawMaterials')}</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addRawMaterial')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : materials.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              {t('noRawMaterialsStart')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left">{t('rawMaterialName')}</th>
                    <th className="p-3 text-left">{t('unit')}</th>
                    <th className="p-3 text-left">{t('pricePerUnit')}</th>
                    <th className="p-3 text-left">{t('stock')}</th>
                    <th className="p-3 text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{material.name}</td>
                      <td className="p-3">{material.unit}</td>
                      <td className="p-3">Rp {parseFloat(material.price_per_unit).toLocaleString('id-ID')}</td>
                      <td className="p-3">
                        <span className={material.stock <= 0 ? 'text-red-600 font-medium' : ''}>
                          {formatStock(material.stock)} {material.unit}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(material)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDelete(material.id, material.name)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentMaterial?.id ? t('editRawMaterial') : t('addRawMaterial')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('rawMaterialName')} *</Label>
              <Input
                id="name"
                value={currentMaterial?.name || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, name: e.target.value })}
                placeholder={t('rawMaterialPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">{t('unit')} *</Label>
              <Input
                id="unit"
                value={currentMaterial?.unit || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, unit: e.target.value })}
                placeholder={t('unitPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">{t('pricePerUnit')}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={currentMaterial?.price_per_unit || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, price_per_unit: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">{t('stock')}</Label>
              <Input
                id="stock"
                type="number"
                step="0.001"
                value={currentMaterial?.stock || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, stock: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t('decimalNote')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RawMaterialsManagement;