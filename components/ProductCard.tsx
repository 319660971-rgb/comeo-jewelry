import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CatalogSummary } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: CatalogSummary; priority?: boolean }) {
  return (
    <article className="product-card">
      <Link href={`/products/${encodeURIComponent(product.sku)}`} className="product-image-wrap" aria-label={`View ${product.title}`}>
        {product.primaryImage ? <img src={product.primaryImage} alt={product.title} loading={priority ? "eager" : "lazy"} /> : <div className="image-placeholder">HJ</div>}
        <div className="product-badges">{product.isNew && <span className="badge badge-new">New</span>}{product.materials.some((m) => /stainless/i.test(m)) && <span className="badge">Stainless steel</span>}</div>
        <span className="view-icon"><ArrowUpRight size={17} /></span>
      </Link>
      <div className="product-card-body">
        <div className="product-meta"><span>{product.category}</span><span>{product.imageCount} photos</span></div>
        <Link href={`/products/${encodeURIComponent(product.sku)}`}><h2>{product.title}</h2></Link>
        <p className="sku">SKU {product.sku}</p>
        <div className="product-card-footer"><strong>{product.priceLabel}</strong><span>No MOQ · Mixable</span></div>
      </div>
    </article>
  );
}
