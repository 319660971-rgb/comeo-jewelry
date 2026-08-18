export type Price = { amount: number; currency: "USD" };

export type CatalogVariant = {
  id: string;
  sku: string;
  name: string;
  color: string | null;
  moq: string | null;
  moqUnits: number | null;
  price: Price | null;
  stock: number | null;
};

export type CatalogProduct = {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  originalCategory: string;
  materials: string[];
  colors: string[];
  styles: string[];
  crafts: string[];
  moq: string | null;
  moqUnits: number | null;
  price: Price | null;
  priceLabel: string;
  showPrice: boolean;
  imageFiles: string[];
  primaryImage: string | null;
  variants: CatalogVariant[];
  createdAt: string | null;
  isNew: boolean;
  sourceUpdatedAt: string | null;
};

export type CatalogSummary = Omit<CatalogProduct, "description" | "variants" | "imageFiles"> & {
  imageCount: number;
};

export type SelectionItem = {
  sku: string;
  variantSku: string;
  title: string;
  image: string | null;
  quantity: number;
  moqUnits: number | null;
  price: number | null;
};
