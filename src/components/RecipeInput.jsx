import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const RecipeInput = ({ recipe, setRecipe, rawMaterials, readOnly = false, className = '' }) => {
  const { t } = useLanguage();

  // Debug logging
  React.useEffect(() => {
    console.log('RecipeInput mounted/updated:', {
      recipeCount: recipe?.length || 0,
      rawMaterialsCount: rawMaterials?.length || 0,
      rawMaterials: rawMaterials
    });
  }, [recipe, rawMaterials]);

  const addIngredient = () => {
    setRecipe([...recipe, { raw_material_id: '', quantity: 0, unit: '' }]);
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...recipe];
    updated[index][field] = value;
    
    // If raw_material_id changed, update unit from selected raw material
    if (field === 'raw_material_id' && value) {
      const material = rawMaterials.find(m => m.id === value);
      if (material) {
        updated[index].unit = material.unit;
        updated[index].price_per_unit = material.price_per_unit;
      }
    }
    
    setRecipe(updated);
  };

  const removeIngredient = (index) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  // Calculate total HPP from recipe
  const totalHPP = recipe.reduce((sum, item) => {
    if (!item.raw_material_id || !item.quantity) return sum;
    
    // Get price from raw material
    const material = rawMaterials.find(m => m.id === item.raw_material_id);
    const pricePerUnit = material ? parseFloat(material.price_per_unit) : parseFloat(item.price_per_unit) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    
    return sum + (pricePerUnit * quantity);
  }, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {t('recipe') || 'resep/bahan baku'}
        </Label>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addIngredient}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('addIngredient') || 'tambah bahan'}
          </Button>
        )}
      </div>

      {recipe.length > 0 && (
        <Card className="p-3 space-y-2">
          {recipe.map((item, index) => {
            const selectedMaterial = rawMaterials.find(m => m.id === item.raw_material_id);
            
            return (
              <div key={index} className="flex gap-2 items-end">
                {/* Raw Material Selector */}
                <div className="flex-1 space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">
                      {t('rawMaterialName') || 'bahan baku'}
                    </Label>
                  )}
                  {readOnly ? (
                    <Input
                      value={item.raw_materials?.name || selectedMaterial?.name || '-'}
                      disabled
                      className="h-9 text-sm bg-muted"
                    />
                  ) : (
                    <Select 
                      value={item.raw_material_id || ''} 
                      onValueChange={(value) => updateIngredient(index, 'raw_material_id', value)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('selectRawMaterial') || 'pilih bahan'} />
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials && rawMaterials.length > 0 ? (
                          rawMaterials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name} ({material.unit})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            {t('noRawMaterials') || 'belum ada bahan baku, tambahkan di tab bahan baku terlebih dahulu'}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Quantity Input */}
                <div className="w-28 space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">
                      {t('quantity') || 'jumlah'}
                    </Label>
                  )}
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0"
                    value={item.quantity || ''}
                    onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                    className="h-9 text-sm no-spin"
                    min="0"
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </div>

                {/* Unit Display */}
                <div className="w-20 space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">
                      {t('unit') || 'satuan'}
                    </Label>
                  )}
                  <div className="h-9 px-3 flex items-center text-sm text-muted-foreground border rounded-md bg-muted">
                    {item.raw_materials?.unit || selectedMaterial?.unit || item.unit || '-'}
                  </div>
                </div>

                {/* Cost Display (for reference) */}
                <div className="w-24 space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">biaya</Label>
                  )}
                  <div className="h-9 px-2 flex items-center text-xs text-muted-foreground border rounded-md bg-muted">
                    {(() => {
                      const material = rawMaterials.find(m => m.id === item.raw_material_id);
                      const pricePerUnit = material 
                        ? parseFloat(material.price_per_unit) 
                        : (item.raw_materials?.price_per_unit ? parseFloat(item.raw_materials.price_per_unit) : 0);
                      const quantity = parseFloat(item.quantity) || 0;
                      const cost = pricePerUnit * quantity;
                      return cost > 0 ? `Rp ${cost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : '-';
                    })()}
                  </div>
                </div>

                {/* Delete Button */}
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeIngredient(index)}
                    className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
          
          {/* Total HPP Display */}
          {totalHPP > 0 && (
            <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
              <span>{t('totalRecipeCost') || 'total biaya resep'}:</span>
              <span className="text-lg font-semibold text-primary">
                Rp {totalHPP.toLocaleString('id-ID')}
              </span>
            </div>
          )}
          
          <div className="pt-1 px-2 py-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-100">
            💡 <strong>info:</strong> total biaya resep akan otomatis disimpan sebagai HPP produk, stok bahan baku akan dikurangi otomatis saat penjualan
          </div>
        </Card>
      )}
      
      {recipe.length === 0 && !readOnly && (
        <p className="text-sm text-muted-foreground italic">
          klik tombol "+ tambah bahan" untuk menambahkan bahan baku ke resep produk
        </p>
      )}
    </div>
  );
};

export default RecipeInput;