import { describe, expect, it } from "vitest";
import { filterProducts, getCatalogFilters, getProduct, getProducts, normalizeCategory } from "./catalog";

describe("QIFU catalog normalization", () => {
  const products = getProducts();

  it("publishes only the strict stainless steel catalog", () => {
    expect(products).toHaveLength(448);
    expect(products.reduce((sum, product) => sum + product.variants.length, 0)).toBe(6035);
    expect(products.reduce((sum, product) => sum + product.imageFiles.length, 0)).toBe(4569);
    expect(products.every((product) => product.materials.length === 1 && product.materials[0] === "Stainless Steel")).toBe(true);
    expect(products.every((product) => product.moq === null && product.moqUnits === null && product.variants.every((variant) => variant.moq === null && variant.moqUnits === null))).toBe(true);
  });

  it("maps every product into one of seven public categories", () => {
    expect(getCatalogFilters().categories).toEqual([
      "All",
      "Rings",
      "Earrings",
      "Necklaces & Chains",
      "Bracelets & Bangles",
      "Charms & Pendants",
      "Body Jewelry",
      "Accessories",
    ]);
  });

  it("never exposes a remote QIFU image URL", () => {
    expect(products.every((product) => !product.primaryImage || product.primaryImage.startsWith("/media/products/"))).toBe(true);
  });

  it("only shows prices when the source showPrice contract allows it", () => {
    expect(products.every((product) => product.showPrice || product.price === null)).toBe(true);
    expect(products.some((product) => product.price !== null)).toBe(true);
    expect(products.some((product) => product.price === null)).toBe(true);
  });

  it("supports category, material and price filtering", () => {
    const result = filterProducts({ category: "rings", material: "Stainless Steel", price: "request", pageSize: 48 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((product) => product.category === "Rings" && product.materials.includes("Stainless Steel") && product.price === null)).toBe(true);
  });

  it("classifies explicit product names before unreliable source categories", () => {
    expect(normalizeCategory("Earrings", "3 pairs earrings set")).toBe("Earrings");
    expect(normalizeCategory("Ring", "Classic hoop earrings")).toBe("Earrings");
    expect(normalizeCategory("Lady Bracelet", "Pendant Necklace")).toBe("Necklaces & Chains");
    expect(normalizeCategory("lady jewelry", "Mixed necklace and earrings set")).toBe("Accessories");
    expect(normalizeCategory("lady jewelry", "268132")).toBe("Necklaces & Chains");
    expect(normalizeCategory("man jewelry", "2660526")).toBe("Necklaces & Chains");
    expect(normalizeCategory("Sensitive Package", "267025")).toBe("Bracelets & Bangles");
  });

  it("does not leave explicit earrings or necklaces in conflicting categories", () => {
    expect(products.filter((product) => product.category === "Rings").some((product) => /\bearrings?\b/i.test(product.title))).toBe(false);
    expect(products.filter((product) => product.category === "Bracelets & Bangles").some((product) => /\bnecklaces?\b/i.test(product.title))).toBe(false);
    expect(products.filter((product) => product.category === "Necklaces & Chains").some((product) => /\bbracelets?|\bbangles?\b/i.test(product.title))).toBe(false);
  });

  it("loads a product with no MOQ and local media", () => {
    const product = getProduct("2672511");
    expect(product?.variants).toHaveLength(20);
    expect(product?.variants[0].moqUnits).toBeNull();
    expect(product?.primaryImage).toBe("/media/products/2672511/01.jpg");
  });
});
