/// <reference types="bun" />
import { test, expect } from "bun:test";
import { remainingStock, usedQuantity } from "./material-usage";

test("completed service without norms deducts actual materials", () => {
  expect(remainingStock(10, 0, 2)).toBe(8);
});
test("existing norm consumption is not deducted twice", () => {
  expect(remainingStock(8, 2, 2)).toBe(8);
  expect(remainingStock(8, 2, 3)).toBe(7);
});
test("corrections refund stock and report net consumption", () => {
  expect(remainingStock(7, 3, 1)).toBe(9);
  expect(usedQuantity([
    { material_id: "paint", quantity_change: -2 },
    { material_id: "paint", quantity_change: -1 },
    { material_id: "paint", quantity_change: 2 },
  ], "paint")).toBe(1);
});