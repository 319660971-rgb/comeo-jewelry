import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { getCatalogFilters } from "@/lib/catalog";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCatalogFilters().categories.find((name) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === slug);
  if (!category) notFound();
  return <div className="catalog-page"><div className="catalog-hero"><p className="eyebrow">Stainless steel wholesale collection</p><h1>{category}</h1><p>No MOQ. Mix these styles into any broader store assortment.</p></div><Suspense fallback={<div className="loading-line">Loading collection…</div>}><CatalogBrowser initialCategory={slug} /></Suspense></div>;
}
