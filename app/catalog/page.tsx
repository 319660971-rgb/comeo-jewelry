import { Suspense } from "react";
import { CatalogBrowser } from "@/components/CatalogBrowser";

export const metadata = { title: "Wholesale Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const params = await searchParams;
  return <div className="catalog-page"><div className="catalog-hero"><p className="eyebrow">Stainless steel wholesale catalog</p><h1>Shop all jewelry</h1><p>No MOQ. Mix any stainless steel products and variants in one selection.</p></div><Suspense fallback={<div className="loading-line">Loading wholesale catalog…</div>}><CatalogBrowser initialQuery={params.q || ""} initialSort={params.sort || "featured"} /></Suspense></div>;
}
