function toIntOrZero(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.trunc(numberValue);
}

export function computeReturnedQtyBySaleItemId(allReturnItems = []) {
  const map = new Map();
  const safeItems = Array.isArray(allReturnItems) ? allReturnItems : [];

  for (const item of safeItems) {
    const saleItemId = item?.sale_item_id ?? item?.sale_item_id?.id ?? item?.sale_item_id;
    if (!saleItemId) continue;
    const qty = Math.max(0, toIntOrZero(item?.quantity ?? 0));
    map.set(saleItemId, (map.get(saleItemId) || 0) + qty);
  }

  return map;
}

export function computeRemainingQty({ saleItems = [], allReturnItems = [] } = {}) {
  const safeSaleItems = Array.isArray(saleItems) ? saleItems : [];
  const returnedQtyMap = computeReturnedQtyBySaleItemId(allReturnItems);

  const remainingMap = new Map();
  for (const saleItem of safeSaleItems) {
    const saleItemId = saleItem?.id;
    if (!saleItemId) continue;
    const soldQty = Math.max(0, toIntOrZero(saleItem?.quantity ?? 0));
    const returnedQty = Math.max(0, toIntOrZero(returnedQtyMap.get(saleItemId) || 0));
    remainingMap.set(saleItemId, Math.max(0, soldQty - returnedQty));
  }

  return remainingMap;
}

export function computeReturnStatus({ saleItems = [], allReturnItems = [] } = {}) {
  const safeSaleItems = Array.isArray(saleItems) ? saleItems : [];
  const returnedQtyMap = computeReturnedQtyBySaleItemId(allReturnItems);

  let anyReturned = false;
  let allReturned = safeSaleItems.length > 0;

  for (const saleItem of safeSaleItems) {
    const saleItemId = saleItem?.id;
    if (!saleItemId) continue;
    const soldQty = Math.max(0, toIntOrZero(saleItem?.quantity ?? 0));
    const returnedQty = Math.max(0, toIntOrZero(returnedQtyMap.get(saleItemId) || 0));

    if (returnedQty > 0) anyReturned = true;
    if (returnedQty < soldQty) allReturned = false;
  }

  if (!anyReturned) return 'none';
  if (allReturned) return 'full';
  return 'partial';
}

