const THERMAL_RECEIPT_LAYOUTS = {
  '58mm': {
    defaultHorizontalPaddingPx: 6,
    verticalPaddingPx: 3,
    hrMarginYpx: 3,
    itemLineGapPx: 2,
    itemSpaceGapPx: 4,
    noteGapPx: 4,
    barcodeMarginBottomPx: 4,
    barcodeMarginPx: 2,
    printTableCellPadding: '1px 2px',
    imageMaxWidthPx: 48,
    lineHeights: {
      compact: '1.15',
      normal: '1.30',
      relaxed: '1.45',
    },
  },
  '80mm': {
    defaultHorizontalPaddingPx: 8,
    verticalPaddingPx: 4,
    hrMarginYpx: 4,
    itemLineGapPx: 3,
    itemSpaceGapPx: 4,
    noteGapPx: 4,
    barcodeMarginBottomPx: 4,
    barcodeMarginPx: 2,
    printTableCellPadding: '2px 3px',
    imageMaxWidthPx: 64,
    lineHeights: {
      compact: '1.15',
      normal: '1.30',
      relaxed: '1.45',
    },
  },
};

export const isThermalPaperSize = (paperSize) => (
  paperSize === '58mm' || paperSize === '80mm'
);

export const getDefaultThermalMargin = (paperSize) => (
  THERMAL_RECEIPT_LAYOUTS[paperSize]?.defaultHorizontalPaddingPx ?? 10
);

export const resolveReceiptMargin = (paperSize, margin) => {
  const parsedMargin = Number(margin);

  if (Number.isFinite(parsedMargin)) {
    return parsedMargin;
  }

  if (isThermalPaperSize(paperSize)) {
    return getDefaultThermalMargin(paperSize);
  }

  return 10;
};

export const getThermalReceiptLayout = (paperSize, lineSpacing = 'normal') => {
  const layout = THERMAL_RECEIPT_LAYOUTS[paperSize];

  if (!layout) {
    return null;
  }

  return {
    ...layout,
    lineHeight: layout.lineHeights[lineSpacing] || layout.lineHeights.normal,
  };
};
