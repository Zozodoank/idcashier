import * as XLSX from 'xlsx';

const INVISIBLE_SPREADSHEET_CHARACTERS = /[\u200B-\u200D\uFEFF]/g;
const NON_BREAKING_SPACES = /\u00A0/g;

export const PRODUCT_IMPORT_COLUMNS = [
  { key: 'name', header: 'Nama', aliases: ['name'] },
  { key: 'barcode', header: 'Barcode', aliases: ['barcode'] },
  { key: 'categoryName', header: 'Kategori', aliases: ['category'] },
  { key: 'supplierName', header: 'Supplier', aliases: ['supplier'] },
  { key: 'price', header: 'Harga Jual', aliases: ['price', 'sell price'] },
  { key: 'cost', header: 'Harga Modal', aliases: ['cost', 'cost price'] },
  { key: 'stock', header: 'Stock', aliases: ['stok'] },
];

export const PRODUCT_EXPORT_COLUMN_WIDTHS = [28, 20, 20, 20, 16, 16, 12];

export function normalizeSpreadsheetText(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(NON_BREAKING_SPACES, ' ')
    .replace(INVISIBLE_SPREADSHEET_CHARACTERS, '')
    .trim();
}

export function normalizeProductImportHeader(value) {
  return normalizeSpreadsheetText(value)
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeProductLookupName(value) {
  return normalizeSpreadsheetText(value).toLowerCase();
}

function getHeaderCandidates(column) {
  return [column.header, ...(column.aliases || [])].map(normalizeProductImportHeader);
}

export function getProductImportColumnIndexes(headerRow = []) {
  const lookup = new Map();

  headerRow.forEach((cell, index) => {
    const normalizedHeader = normalizeProductImportHeader(cell);
    if (normalizedHeader && !lookup.has(normalizedHeader)) {
      lookup.set(normalizedHeader, index);
    }
  });

  const columnIndexes = {};
  const missingHeaders = [];

  PRODUCT_IMPORT_COLUMNS.forEach((column) => {
    const matchedHeader = getHeaderCandidates(column).find((candidate) => lookup.has(candidate));

    if (matchedHeader) {
      columnIndexes[column.key] = lookup.get(matchedHeader);
      return;
    }

    missingHeaders.push(column.header);
  });

  return { columnIndexes, missingHeaders };
}

function isRowBlank(row = []) {
  return row.every((cell) => normalizeSpreadsheetText(cell) === '');
}

function getRowCell(row, index) {
  if (index === undefined || index === null) return '';
  return row[index] ?? '';
}

function normalizeNumberString(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalizedText = normalizeSpreadsheetText(value);
  if (!normalizedText) return null;

  let candidate = normalizedText.replace(/\s+/g, '');
  const hasComma = candidate.includes(',');
  const hasDot = candidate.includes('.');

  if (hasComma && hasDot) {
    if (candidate.lastIndexOf(',') > candidate.lastIndexOf('.')) {
      candidate = candidate.replace(/\./g, '').replace(',', '.');
    } else {
      candidate = candidate.replace(/,/g, '');
    }
  } else if (hasComma) {
    candidate = /,\d{1,2}$/.test(candidate)
      ? candidate.replace(/\./g, '').replace(',', '.')
      : candidate.replace(/,/g, '');
  } else if (hasDot) {
    candidate = /\.\d{1,2}$/.test(candidate)
      ? candidate.replace(/,/g, '')
      : candidate.replace(/\./g, '');
  }

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDecimalField(value, label) {
  const parsed = normalizeNumberString(value);

  if (parsed === null) {
    return { value: 0 };
  }

  if (Number.isNaN(parsed)) {
    return { error: `${label} tidak valid` };
  }

  return { value: parsed };
}

function parseIntegerField(value, label) {
  const parsed = normalizeNumberString(value);

  if (parsed === null) {
    return { value: 0 };
  }

  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    return { error: `${label} tidak valid` };
  }

  return { value: parsed };
}

export function parseProductImportWorksheet(worksheet) {
  const rowsMatrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });

  if (rowsMatrix.length === 0) {
    return {
      rows: [],
      errors: [],
      missingHeaders: PRODUCT_IMPORT_COLUMNS.map((column) => column.header),
    };
  }

  const [headerRow, ...dataRows] = rowsMatrix;
  const { columnIndexes, missingHeaders } = getProductImportColumnIndexes(headerRow);

  if (missingHeaders.length > 0) {
    return { rows: [], errors: [], missingHeaders };
  }

  const rows = [];
  const errors = [];

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (isRowBlank(row)) {
      return;
    }

    const name = normalizeSpreadsheetText(getRowCell(row, columnIndexes.name));
    const barcode = normalizeSpreadsheetText(getRowCell(row, columnIndexes.barcode));
    const categoryName = normalizeSpreadsheetText(getRowCell(row, columnIndexes.categoryName));
    const supplierName = normalizeSpreadsheetText(getRowCell(row, columnIndexes.supplierName));
    const priceResult = parseDecimalField(getRowCell(row, columnIndexes.price), 'Harga Jual');
    const costResult = parseDecimalField(getRowCell(row, columnIndexes.cost), 'Harga Modal');
    const stockResult = parseIntegerField(getRowCell(row, columnIndexes.stock), 'Stock');

    const issues = [];

    if (!name) {
      issues.push('Nama wajib diisi');
    }
    if (priceResult.error) {
      issues.push(priceResult.error);
    }
    if (costResult.error) {
      issues.push(costResult.error);
    }
    if (stockResult.error) {
      issues.push(stockResult.error);
    }

    if (issues.length > 0) {
      errors.push({
        rowNumber,
        reason: issues.join(', '),
      });
      return;
    }

    rows.push({
      rowNumber,
      data: {
        name,
        barcode,
        categoryName,
        supplierName,
        price: priceResult.value,
        cost: costResult.value,
        stock: stockResult.value,
      },
    });
  });

  return { rows, errors, missingHeaders: [] };
}

export function parseProductImportWorkbook(fileData) {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      errors: [],
      missingHeaders: PRODUCT_IMPORT_COLUMNS.map((column) => column.header),
    };
  }

  return parseProductImportWorksheet(workbook.Sheets[firstSheetName]);
}

export function buildProductExportRows(products) {
  return products.map((product) => ({
    Nama: product.name || '',
    Barcode: product.barcode || '',
    Kategori: product.category || '',
    Supplier: product.supplier || '',
    'Harga Jual': product.price ?? 0,
    'Harga Modal': product.cost ?? 0,
    Stock: product.stock ?? 0,
  }));
}

export function formatProductImportErrors(errors, maxErrors = 3) {
  if (!errors || errors.length === 0) return '';

  const visibleErrors = errors
    .slice(0, maxErrors)
    .map((error) => `Baris ${error.rowNumber}: ${error.reason}`);

  const remainingErrors = errors.length - visibleErrors.length;
  if (remainingErrors > 0) {
    visibleErrors.push(`+${remainingErrors} baris lainnya`);
  }

  return visibleErrors.join('; ');
}
