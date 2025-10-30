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
        description: error.message || 'Failed to load raw materials', 
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
    if (!window.confirm(`hapus bahan baku "${name}"?`)) return;
    
    try {
      await rawMaterialsAPI.delete(id, token);
      toast({ 
        title: t('success'), 
        description: 'bahan baku berhasil dihapus' 
      });
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting raw material:', error);
      toast({ 
        title: t('error'), 
        description: error.message || 'gagal menghapus bahan baku', 
        variant: 'destructive' 
      });
    }
  };

  const handleSubmit = async () => {
    if (!currentMaterial.name || !currentMaterial.unit) {
      toast({ 
        title: t('error'), 
        description: 'nama dan satuan harus diisi', 
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
        toast({ title: t('success'), description: 'bahan baku berhasil diupdate' });
      } else {
        await rawMaterialsAPI.create(materialData, token);
        toast({ title: t('success'), description: 'bahan baku berhasil ditambahkan' });
      }

      setIsDialogOpen(false);
      setCurrentMaterial(null);
      await fetchMaterials();
    } catch (error) {
      console.error('Error saving raw material:', error);
      toast({ 
        title: t('error'), 
        description: error.message || 'gagal menyimpan bahan baku', 
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
          <CardTitle>{t('rawMaterials') || 'bahan baku'}</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addRawMaterial') || 'tambah bahan baku'}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : materials.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              belum ada bahan baku, klik "tambah bahan baku" untuk memulai
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left">{t('rawMaterialName') || 'nama bahan'}</th>
                    <th className="p-3 text-left">{t('unit') || 'satuan'}</th>
                    <th className="p-3 text-left">{t('pricePerUnit') || 'harga/satuan'}</th>
                    <th className="p-3 text-left">{t('stock') || 'stok'}</th>
                    <th className="p-3 text-left">{t('actions') || 'aksi'}</th>
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
              {currentMaterial?.id ? 'edit' : 'tambah'} bahan baku
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('rawMaterialName') || 'nama bahan'} *</Label>
              <Input
                id="name"
                value={currentMaterial?.name || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, name: e.target.value })}
                placeholder="contoh: tepung, minyak, kemasan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">{t('unit') || 'satuan'} *</Label>
              <Input
                id="unit"
                value={currentMaterial?.unit || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, unit: e.target.value })}
                placeholder="contoh: kg, gram, liter, pcs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">{t('pricePerUnit') || 'harga/satuan'}</Label>
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
              <Label htmlFor="stock">{t('stock') || 'stok'}</Label>
              <Input
                id="stock"
                type="number"
                step="0.001"
                value={currentMaterial?.stock || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, stock: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                bisa pakai desimal jika diperlukan (contoh: 10 atau 0.5)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              {t('cancel') || 'batal'}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (t('saving') || 'menyimpan...') : (t('save') || 'simpan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RawMaterialsManagement;