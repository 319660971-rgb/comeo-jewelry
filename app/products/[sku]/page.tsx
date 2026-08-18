import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getProduct, mediaUrl } from "@/lib/catalog";
import { ProductConfigurator } from "@/components/ProductConfigurator";

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = getProduct(decodeURIComponent(sku));
  if (!product) notFound();
  const images = product.imageFiles.map((file) => mediaUrl(product.sku, file));
  return <div className="product-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/catalog">Catalog</Link><ChevronRight /><Link href={`/collections/${product.categorySlug}`}>{product.category}</Link><ChevronRight /><span>{product.sku}</span></nav><ProductConfigurator product={product} images={images} /><section className="product-assurance"><div><strong>No MOQ</strong><span>Start with any quantity for every selected style.</span></div><div><strong>Mixed selection</strong><span>Combine any stainless steel styles in one selection.</span></div><div><strong>Quote support</strong><span>Pricing and availability are confirmed by our sales team.</span></div></section></div>;
}
