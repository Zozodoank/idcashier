import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildProductExportRows,
  getProductImportColumnIndexes,
  normalizeProductImportHeader,
  parseProductImportWorksheet,
} from './productImport';

describe('normalizeProductImportHeader', () => {
  it('normalizes spacing, BOM, and casing', () => {
    expect(normalizeProductImportHeader('\uFEFF  Harga\u00A0Jual  ')).toBe('harga jual');
  });
});

describe('getProductImportColumnIndexes', () => {
  it('matches canonical and alias headers', () => {
    const { columnIndexes, missingHeaders } = getProductImportColumnIndexes([
      ' Name ',
      'barcode',
      'Category',
      'Supplier',
      'Price',
      'Cost',
      'stok',
    ]);

    expect(missingHeaders).toEqual([]);
    expect(columnIndexes).toEqual({
      name: 0,
      barcode: 1,
      categoryName: 2,
      supplierName: 3,
      price: 4,
      cost: 5,
      stock: 6,
    });
  });
});

describe('parseProductImportWorksheet', () => {
  it('reads canonical export headers without shifting cells when middle values are blank', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nama', 'Barcode', 'Kategori', 'Supplier', 'Harga Jual', 'Harga Modal', 'Stock'],
      ['Produk A', '', 'Minuman', 'Supplier A', '15.000', '10.000', '7'],
    ]);

    const result = parseProductImportWorksheet(worksheet);

    expect(result.missingHeaders).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        data: {
          name: 'Produk A',
          barcode: '',
          categoryName: 'Minuman',
          supplierName: 'Supplier A',
          price: 15000,
          cost: 10000,
          stock: 7,
        },
      },
    ]);
  });

  it('accepts headers edited by Excel with BOM, spaces, and English aliases', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['\uFEFF Name ', ' Barcode ', ' Category ', ' Supplier ', ' Price ', ' Cost ', ' stok '],
      ['Produk B', '000123456789', 'Snack', 'PT Maju', '12500', '8000', 12],
    ]);

    const result = parseProductImportWorksheet(worksheet);

    expect(result.missingHeaders).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].data).toEqual({
      name: 'Produk B',
      barcode: '000123456789',
      categoryName: 'Snack',
      supplierName: 'PT Maju',
      price: 12500,
      cost: 8000,
      stock: 12,
    });
  });

  it('keeps barcode text and parses numeric strings from Excel displays', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nama', 'Barcode', 'Kategori', 'Supplier', 'Harga Jual', 'Harga Modal', 'Stock'],
      ['Produk C', '001230045600', 'Aksesoris', 'Supplier B', '12,500.50', '7.500,25', 3],
    ]);

    const result = parseProductImportWorksheet(worksheet);

    expect(result.errors).toEqual([]);
    expect(result.rows[0].data.barcode).toBe('001230045600');
    expect(result.rows[0].data.price).toBe(12500.5);
    expect(result.rows[0].data.cost).toBe(7500.25);
  });

  it('skips empty rows and reports invalid rows with Excel row numbers', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nama', 'Barcode', 'Kategori', 'Supplier', 'Harga Jual', 'Harga Modal', 'Stock'],
      ['', '', '', '', '', '', ''],
      ['', 'ABC', 'Makanan', 'Supplier C', 'sepuluh ribu', '5000', '2.5'],
      ['Produk D', '', '', '', '', '', ''],
    ]);

    const result = parseProductImportWorksheet(worksheet);

    expect(result.rows).toEqual([
      {
        rowNumber: 4,
        data: {
          name: 'Produk D',
          barcode: '',
          categoryName: '',
          supplierName: '',
          price: 0,
          cost: 0,
          stock: 0,
        },
      },
    ]);
    expect(result.errors).toEqual([
      {
        rowNumber: 3,
        reason: 'Nama wajib diisi, Harga Jual tidak valid, Stock tidak valid',
      },
    ]);
  });
});

describe('buildProductExportRows', () => {
  it('uses the canonical export template order', () => {
    const rows = buildProductExportRows([
      {
        name: 'Produk E',
        barcode: '123',
        category: 'Elektronik',
        supplier: 'Supplier E',
        price: 50000,
        cost: 35000,
        stock: 4,
      },
    ]);

    expect(Object.keys(rows[0])).toEqual([
      'Nama',
      'Barcode',
      'Kategori',
      'Supplier',
      'Harga Jual',
      'Harga Modal',
      'Stock',
    ]);
    expect(rows[0]).toEqual({
      Nama: 'Produk E',
      Barcode: '123',
      Kategori: 'Elektronik',
      Supplier: 'Supplier E',
      'Harga Jual': 50000,
      'Harga Modal': 35000,
      Stock: 4,
    });
  });
});
