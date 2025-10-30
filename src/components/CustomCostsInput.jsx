import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const CustomCostsInput = ({ customCosts, setCustomCosts, className = '' }) => {
  const { t } = useLanguage();

  const addCost = () => {
    setCustomCosts([...customCosts, { label: '', amount: 0 }]);
  };

  const updateCost = (index, field, value) => {
    const updated = [...customCosts];
    updated[index][field] = value;
    setCustomCosts(updated);
  };

  const removeCost = (index) => {
    setCustomCosts(customCosts.filter((_, i) => i !== index));
  };

  const totalCustomCosts = customCosts.reduce((sum, cost) => 
    sum + (parseFloat(cost.amount) || 0), 0
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Biaya Tambahan HPP (Opsional)
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addCost}
          className="h-8"
        >
          <Plus className="w-4 h-4 mr-1" />
          Tambah
        </Button>
      </div>

      {customCosts.length > 0 && (
        <Card className="p-3 space-y-2">
          {customCosts.map((cost, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                placeholder="Label (cth: Ongkir, Packaging)"
                value={cost.label}
                onChange={(e) => updateCost(index, 'label', e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="0"
                value={cost.amount}
                onChange={(e) => updateCost(index, 'amount', e.target.value)}
                className="w-32 h-9 text-sm no-spin"
                min="0"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeCost(index)}
                className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          
          {totalCustomCosts > 0 && (
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="font-medium">Total Biaya Tambahan:</span>
              <span className="font-semibold">Rp {totalCustomCosts.toLocaleString('id-ID')}</span>
            </div>
          )}
          
          <div className="pt-1 px-2 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-100">
            💡 <strong>Catatan:</strong> Biaya ini untuk perhitungan HPP internal saja dan tidak ditambahkan ke total pembayaran pelanggan. Biaya akan dibagi rata ke semua produk dalam transaksi untuk menghitung profit aktual.
          </div>
        </Card>
      )}
    </div>
  );
};

export default CustomCostsInput;

