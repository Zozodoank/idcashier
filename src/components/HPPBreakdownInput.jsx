import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HPPBreakdownInput = ({ hppBreakdown, setHppBreakdown, readOnly = false, className = '' }) => {
  const { t } = useLanguage();

  const addItem = () => {
    setHppBreakdown([...hppBreakdown, { label: '', amount: 0 }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...hppBreakdown];
    updated[index][field] = value;
    setHppBreakdown(updated);
  };

  const removeItem = (index) => {
    setHppBreakdown(hppBreakdown.filter((_, i) => i !== index));
  };

  const totalHPP = hppBreakdown.reduce((sum, item) => 
    sum + (parseFloat(item.amount) || 0), 0
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {t('hppBreakdown') || 'rincian HPP'}
        </Label>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addItem}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('add') || 'tambah'}
          </Button>
        )}
      </div>

      {hppBreakdown.length > 0 && (
        <Card className="p-3 space-y-2">
          {hppBreakdown.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                placeholder={t('hppItemLabel') || 'label (mis: bahan baku, tenaga kerja)'}
                value={item.label}
                onChange={(e) => updateItem(index, 'label', e.target.value)}
                className="flex-1 h-9 text-sm"
                readOnly={readOnly}
                disabled={readOnly}
              />
              <Input
                type="number"
                placeholder="0"
                value={item.amount}
                onChange={(e) => updateItem(index, 'amount', e.target.value)}
                className="w-32 h-9 text-sm no-spin"
                min="0"
                readOnly={readOnly}
                disabled={readOnly}
              />
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                  className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          
          {totalHPP > 0 && (
            <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
              <span>{t('totalHPP') || 'total HPP'}:</span>
              <span className="text-lg font-semibold text-primary">
                Rp {totalHPP.toLocaleString('id-ID')}
              </span>
            </div>
          )}
          
          <div className="pt-1 px-2 py-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-100">
            💡 <strong>info:</strong> rincian ini membantu melacak komponen biaya produksi, total akan tersimpan sebagai HPP produk
          </div>
        </Card>
      )}
      
      {hppBreakdown.length === 0 && !readOnly && (
        <p className="text-sm text-muted-foreground italic">
          klik tombol "+ tambah" untuk merinci komponen HPP (opsional)
        </p>
      )}
    </div>
  );
};

export default HPPBreakdownInput;