import Link from "next/link";
import { ArrowRight, Boxes, Gauge, Layers3, Sparkles } from "lucide-react";
import { getProducts, toSummary } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export default function Home() {
  const products = getProducts();
  const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0);
  const categoryCount = (category: string) => products.filter((product) => product.category === category).length;
  const categoryTiles = [
    { name: "Rings", category: "Rings", href: "/collections/rings", image: "/media/products/2672910/01.jpg" },
    { name: "Earrings", category: "Earrings", href: "/collections/earrings", image: "/media/products/267147/01.jpg" },
    { name: "Bracelets", category: "Bracelets & Bangles", href: "/collections/bracelets-and-bangles", image: "/media/products/268137/01.jpg" },
    { name: "Necklaces", category: "Necklaces & Chains", href: "/collections/necklaces-and-chains", image: "/media/products/267262/01.jpg" },
  ];
  const latest = products.filter((product) => product.primaryImage).sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")).slice(0, 8).map(toSummary);
  return (
    <>
      <section className="hero" style={{ backgroundImage: "url('/hello-jewelry-hero.jpg')" }}>
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow">Hello Jewelry Wholesale</p>
          <h1>Stainless Steel Jewelry Wholesale</h1>
          <p>Build a sellable stainless steel jewelry assortment with no MOQ, mixed orders and fresh designs made for fast product testing.</p>
          <div className="hero-actions"><Link href="/catalog" className="button button-accent">Browse {products.length} styles <ArrowRight /></Link><Link href="/wholesale" className="button button-light">Build my store assortment</Link></div>
        </div>
        <div className="hero-proof"><span>{products.length} products</span><span>{variantCount.toLocaleString("en-US")} variants</span><span>Global buyer support</span></div>
      </section>

      <section className="value-band" aria-label="Hello Jewelry wholesale advantages">
        <div><Boxes /><strong>No MOQ</strong><span>Start with any quantity for every style.</span></div>
        <div><Layers3 /><strong>Mix & Match</strong><span>Build one order across categories and SKUs.</span></div>
        <div><Gauge /><strong>Fast Testing</strong><span>Move from selection to market without a large buy.</span></div>
        <div><Sparkles /><strong>Fresh Designs</strong><span>Keep your assortment current and varied.</span></div>
      </section>

      <section className="section category-section">
        <div className="section-heading"><div><p className="eyebrow">One source, more options</p><h2>Shop the wholesale catalog</h2></div><Link href="/catalog" className="text-link">View all products <ArrowRight /></Link></div>
        <div className="category-grid">{categoryTiles.map((category) => <Link href={category.href} className="category-tile" key={category.name}><img src={category.image} alt={`${category.name} wholesale`} loading="lazy" /><div><h3>{category.name}</h3><p>{categoryCount(category.category)} stainless steel styles</p></div><ArrowRight /></Link>)}</div>
      </section>

      <section className="section new-section">
        <div className="section-heading"><div><p className="eyebrow">Recently added</p><h2>Fresh stainless steel styles</h2></div><Link href="/catalog?sort=newest" className="text-link">Shop new arrivals <ArrowRight /></Link></div>
        <div className="product-grid home-product-grid">{latest.map((product, index) => <ProductCard key={product.sku} product={product} priority={index < 4} />)}</div>
      </section>

      <section className="store-solution-band">
        <div className="store-solution-image"><img src="/media/products/2672910/01.jpg" alt="A broad stainless steel jewelry assortment prepared for store buyers" loading="lazy" /></div>
        <div className="store-solution-copy"><p className="eyebrow">Store-ready assortment service</p><h2>Open with the right mix, not just more stock.</h2><p>Tell us your market, customer, budget and preferred styles. We will shape a mixed assortment across categories so you can launch or refresh your store with less guesswork.</p><ol><li><span>01</span>Share your market and budget</li><li><span>02</span>Receive a curated SKU mix</li><li><span>03</span>Test, reorder and scale winners</li></ol><Link href="/wholesale" className="button button-dark">Build my assortment <ArrowRight /></Link></div>
      </section>
    </>
  );
}
