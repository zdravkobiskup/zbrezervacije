export interface UsageChange { material_id: string; quantity_change: number }

export function usedQuantity(changes: UsageChange[], materialId: string): number {
  return -changes.filter(change => change.material_id === materialId)
    .reduce((sum, change) => sum + change.quantity_change, 0);
}

export function remainingStock(stock: number, previouslyUsed: number, actualUsed: number): number {
  return stock + previouslyUsed - actualUsed;
}