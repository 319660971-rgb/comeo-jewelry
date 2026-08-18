import fs from "node:fs";
import path from "node:path";
import { CatalogProduct, CatalogSummary, CatalogVariant } from "./types";

type RawVariant = {
  id?: string;
  sku?: string;
  name?: string | null;
  color?: string | null;
  moq?: string | number | null;
  salePrice?: number | null;
  buyerTierPriceCny?: number | null;
  usdPriceOverride?: number | null;
  stock?: number | null;
};

type RawProduct = {
  id?: string;
  sku?: string;
  name?: string | null;
  color?: string | null;
  style?: string | null;
  materials?: string[] | null;
  crafts?: string[] | null;
  salePrice?: number | null;
  buyerTierPriceCny?: number | null;
  usdPriceOverride?: number | null;
  showPrice?: boolean;
  estimatedPrice?: number | null;
  moq?: string | number | null;
  description?: string | null;
  notes?: string | null;
  category?: { name?: string | null } | null;
  images?: Array<{ url?: string | null; order?: number | null }>;
  variants?: RawVariant[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type RawFileData = { metadata?: { exchangeRate?: { cnyToUsd?: number } }; products?: RawProduct[] };

const DATA_DIR = process.env.QIFU_DATA_DIR || path.join(process.cwd(), "outputs", "QIFU-2026-08-13");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const MEDIA_MANIFEST_FILE = path.join(process.cwd(), "data", "media-manifest.json");
const DEFAULT_CNY_TO_USD = 0.1479938180022344;
const PUBLIC_CATEGORIES = ["Rings", "Earrings", "Necklaces & Chains", "Bracelets & Bangles", "Charms & Pendants", "Body Jewelry", "Accessories"];
const CATEGORY_OVERRIDES: Record<string, string> = {
  "266298": "Necklaces & Chains",
};

let cachedProducts: CatalogProduct[] | null = null;
let cachedFilters: { categories: string[]; materials: string[]; colors: string[]; styles: string[] } | null = null;
let cachedMedia: Record<string, string[]> | null = null;

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoryFromText(value: string) {
  if (/\bbody\b|\banklets?\b|\bbelly\b|\bwaist\b|\bnose\b/.test(value)) return "Body Jewelry";
  const isEarring = /\bearrings?\b|\bear\s*cuffs?\b/.test(value);
  const isNecklace = /\bnecklaces?\b|\bchokers?\b|\bcollars?\b|\bpendants?\b|\bchains?\b/.test(value);
  const isBracelet = /\bbracelets?\b|\bbangles?\b|\bwrist\b|hand\s+(?:chain|chian)/.test(value);
  const isRing = /\brings?\b/.test(value);
  if ([isEarring, isNecklace, isBracelet, isRing].filter(Boolean).length > 1) return "Accessories";
  if (isEarring) return "Earrings";
  if (isNecklace) return "Necklaces & Chains";
  if (isBracelet) return "Bracelets & Bangles";
  if (isRing) return "Rings";
  if (/\bcharms?\b|\bdiy\b/.test(value)) return "Charms & Pendants";
  return null;
}

export function normalizeCategory(original: string, name = "", style = "") {
  const cleanName = name.trim();
  const nameIsSku = !cleanName || /^\d{5,}[a-z-]*$/i.test(cleanName);
  if (!nameIsSku) {
    const fromName = categoryFromText(cleanName.toLowerCase());
    if (fromName) return fromName;
  }
  const fromSource = categoryFromText(`${original} ${style}`.toLowerCase());
  if (fromSource) return fromSource;
  if (/^(?:lady jewelry|man jewelry)$/i.test(original.trim())) return "Necklaces & Chains";
  if (/^sensitive package$/i.test(original.trim())) return "Bracelets & Bangles";
  return "Accessories";
}

function isStainlessMaterial(value: string) {
  return /^(?:stainless steel|316l ss)$/i.test(value.trim());
}

function isStrictStainlessProduct(raw: RawProduct) {
  const materials = raw.materials?.map((value) => String(value).trim()).filter(Boolean) || [];
  return materials.length > 0 && materials.every(isStainlessMaterial);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.flatMap((value) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))];
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function filterMaterial(value: string) {
  const lower = value.trim().toLowerCase();
  if (/stainless|316l/.test(lower)) return "Stainless Steel";
  if (/925|silver/.test(lower)) return "Silver";
  if (/brass/.test(lower)) return "Brass";
  if (/pearl/.test(lower)) return "Pearl";
  if (/zircon|cz|cubic/.test(lower)) return "Zircon";
  if (/natural stone/.test(lower)) return "Natural Stone";
  if (/alloy/.test(lower)) return "Alloy";
  return titleCase(value.trim());
}

function filterColor(value: string) {
  const lower = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (/multi\s*-?\s*color|colorful/.test(lower)) return "Multi-color";
  if (/rose\s*gold/.test(lower)) return "Rose Gold";
  return titleCase(value.trim());
}

function filterStyle(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "anmial") return "Animal";
  return titleCase(value.trim());
}

function filesForSku(sku: string) {
  if (!cachedMedia) {
    try { cachedMedia = JSON.parse(fs.readFileSync(MEDIA_MANIFEST_FILE, "utf8")) as Record<string, string[]>; }
    catch { cachedMedia = {}; }
  }
  return cachedMedia[sku] || [];
}

function mediaPath(sku: string, file: string) {
  return `/media/products/${encodeURIComponent(sku)}/${encodeURIComponent(file)}`;
}

function resolvePrice(showPrice: boolean, usdOverride?: number | null, buyerTierCny?: number | null, cnyToUsd = DEFAULT_CNY_TO_USD): number | null {
  if (!showPrice) return null;
  if (typeof usdOverride === "number" && usdOverride > 0) return usdOverride;
  if (typeof buyerTierCny === "number" && buyerTierCny > 0) return buyerTierCny * cnyToUsd;
  return null;
}

function buildTitle(raw: RawProduct, category: string, sku: string) {
  const rawName = String(raw.name ?? "").trim();
  const isSkuOnly = !rawName || rawName.toLowerCase() === sku.toLowerCase() || /^\d{5,}[a-z-]*$/i.test(rawName);
  if (!isSkuOnly) return rawName.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const color = raw.color && raw.color.toLowerCase() !== "null" ? `${raw.color} ` : "";
  const style = String(raw.style ?? "").split(",").map((part) => part.trim()).filter(Boolean)[0];
  const stylePart = style ? `${style} ` : "";
  const material = "Stainless Steel ";
  return `${color}${stylePart}${material}${category}`.replace(/\s+/g, " ").trim();
}

function buildDescription(raw: RawProduct, title: string, category: string) {
  const original = [raw.description, raw.notes].find((value) => {
    const text = String(value ?? "").trim();
    return text.length >= 50 && /\s/.test(text);
  });
  if (original) return String(original).trim();
  const style = raw.style ? ` with a ${String(raw.style).split(",")[0].trim().toLowerCase()} feel` : "";
  return `${title} is a stainless steel ${category.toLowerCase()} piece${style}, prepared for mixed wholesale assortments and fast product testing with no minimum quantity per style.`;
}

export function getProducts(): CatalogProduct[] {
  if (cachedProducts) return cachedProducts;
  const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) as RawFileData;
  const cnyToUsd = data.metadata?.exchangeRate?.cnyToUsd || DEFAULT_CNY_TO_USD;
  const rawProducts = (data.products || []).filter(isStrictStainlessProduct);
  const maxCreatedAt = rawProducts.reduce((max, item) => Math.max(max, item.createdAt ? Date.parse(item.createdAt) : 0), 0);

  cachedProducts = rawProducts.map((raw, index) => {
    const sku = String(raw.sku || raw.id || `product-${index}`);
    const originalCategory = String(raw.category?.name || "Uncategorized");
    const category = CATEGORY_OVERRIDES[sku] || normalizeCategory(originalCategory, String(raw.name || ""), String(raw.style || ""));
    const categorySlug = slugify(category);
    const imageFiles = filesForSku(sku);
    const variants: CatalogVariant[] = (raw.variants || []).map((variant, variantIndex) => {
      const variantSku = String(variant.sku || `${sku}-${variantIndex + 1}`);
      const price = resolvePrice(Boolean(raw.showPrice), variant.usdPriceOverride, variant.buyerTierPriceCny, cnyToUsd) ?? resolvePrice(Boolean(raw.showPrice), raw.usdPriceOverride, raw.buyerTierPriceCny, cnyToUsd);
      return {
        id: String(variant.id || variantSku),
        sku: variantSku,
        name: String(variant.name || variantSku),
        color: variant.color || raw.color || null,
        moq: null,
        moqUnits: null,
        price: price == null ? null : { amount: price, currency: "USD" },
        stock: typeof variant.stock === "number" ? variant.stock : null,
      };
    });
    const productPrice = resolvePrice(Boolean(raw.showPrice), raw.usdPriceOverride, raw.buyerTierPriceCny, cnyToUsd) ?? variants.map((variant) => variant.price?.amount).filter((value): value is number => typeof value === "number").sort((a, b) => a - b)[0] ?? null;
    const priceLabel = productPrice == null ? "Request price" : `$${productPrice.toFixed(2)}`;
    const title = buildTitle(raw, category, sku);
    const createdAt = raw.createdAt || null;
    const isNew = Boolean(createdAt && maxCreatedAt - Date.parse(createdAt) <= 45 * 24 * 60 * 60 * 1000);
    return {
      id: String(raw.id || sku),
      sku,
      title,
      description: buildDescription(raw, title, category),
      category,
      categorySlug,
      originalCategory,
      materials: ["Stainless Steel"],
      colors: uniqueValues([raw.color, ...variants.map((variant) => variant.color)]),
      styles: uniqueValues([raw.style]),
      crafts: uniqueValues(raw.crafts || []),
      moq: null,
      moqUnits: null,
      price: productPrice == null ? null : { amount: productPrice, currency: "USD" },
      priceLabel,
      showPrice: Boolean(raw.showPrice),
      imageFiles,
      primaryImage: imageFiles[0] ? mediaPath(sku, imageFiles[0]) : null,
      variants,
      createdAt,
      isNew,
      sourceUpdatedAt: raw.updatedAt || null,
    } satisfies CatalogProduct;
  });
  return cachedProducts;
}

export function getProduct(sku: string) {
  return getProducts().find((product) => product.sku === sku) || null;
}

export function toSummary(product: CatalogProduct): CatalogSummary {
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    category: product.category,
    categorySlug: product.categorySlug,
    originalCategory: product.originalCategory,
    materials: product.materials,
    colors: product.colors,
    styles: product.styles,
    crafts: product.crafts,
    moq: product.moq,
    moqUnits: product.moqUnits,
    price: product.price,
    priceLabel: product.priceLabel,
    showPrice: product.showPrice,
    primaryImage: product.primaryImage,
    createdAt: product.createdAt,
    isNew: product.isNew,
    sourceUpdatedAt: product.sourceUpdatedAt,
    imageCount: product.imageFiles.length,
  };
}

export function getCatalogFilters() {
  if (cachedFilters) return cachedFilters;
  const products = getProducts();
  cachedFilters = {
    categories: ["All", ...PUBLIC_CATEGORIES],
    materials: Array.from(new Set(products.flatMap((product) => product.materials.map(filterMaterial)))).sort(),
    colors: Array.from(new Set(products.flatMap((product) => product.colors.map(filterColor)))).sort(),
    styles: Array.from(new Set(products.flatMap((product) => product.styles.map(filterStyle)))).sort(),
  };
  return cachedFilters;
}

export function filterProducts(params: { query?: string; category?: string; material?: string; color?: string; style?: string; price?: "available" | "request"; sort?: string; page?: number; pageSize?: number }) {
  const all = getProducts();
  const query = params.query?.trim().toLowerCase();
  let filtered = all.filter((product) => {
    if (query && ![product.title, product.sku, product.category, product.materials.join(" "), product.styles.join(" ")].join(" ").toLowerCase().includes(query)) return false;
    if (params.category && params.category !== "all" && product.categorySlug !== params.category) return false;
    if (params.material && !product.materials.some((value) => filterMaterial(value).toLowerCase() === params.material?.toLowerCase())) return false;
    if (params.color && !product.colors.some((value) => filterColor(value).toLowerCase() === params.color?.toLowerCase())) return false;
    if (params.style && !product.styles.some((value) => filterStyle(value).toLowerCase() === params.style?.toLowerCase())) return false;
    if (params.price === "available" && !product.price) return false;
    if (params.price === "request" && product.price) return false;
    return true;
  });
  if (params.sort === "newest") filtered = filtered.sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
  else if (params.sort === "price-low") filtered = filtered.sort((a, b) => (a.price?.amount || Infinity) - (b.price?.amount || Infinity));
  else if (params.sort === "price-high") filtered = filtered.sort((a, b) => (b.price?.amount || 0) - (a.price?.amount || 0));
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(48, Math.max(12, params.pageSize || 24));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary), total: filtered.length, page, pageSize, hasMore: page * pageSize < filtered.length };
}

export function mediaUrl(sku: string, file: string) {
  return mediaPath(sku, file);
}
