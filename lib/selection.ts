import { SelectionItem } from "./types";

const KEY = "hello-jewelry-selection";

export function readSelection(): SelectionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.map((item) => ({ ...item, quantity: Math.max(1, Number(item.quantity) || 1), moqUnits: null })) : [];
  } catch {
    return [];
  }
}

export function writeSelection(items: SelectionItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("hello-selection-change", { detail: items }));
}

export function addSelection(item: SelectionItem) {
  const items = readSelection();
  const index = items.findIndex((existing) => existing.variantSku === item.variantSku);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
  writeSelection(items);
}
