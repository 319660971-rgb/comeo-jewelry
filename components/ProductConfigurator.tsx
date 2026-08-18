"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { Check, ListPlus, Minus, Plus } from "lucide-react";
import { CatalogProduct } from "@/lib/types";
import { addSelection } from "@/lib/selection";

export function ProductConfigurator({ product, images }: { product: CatalogProduct; images: string[] }) {
  const [activeImage, setActiveImage] = useState(images[0] || "");
  const [variantSku, setVariantSku] = useState(product.variants[0]?.sku || product.sku);
  const variant = useMemo(() => product.variants.find((item) => item.sku === variantSku) || null, [product.variants, variantSku]);
  const [quantityInput, setQuantityInput] = useState("1");
  const [added, setAdded] = useState(false);
  const displayPrice = variant?.price?.amount ?? product.price?.amount ?? null;

  const numericQuantity = Number(quantityInput);
  const quantity = Number.isFinite(numericQuantity) && numericQuantity > 0 ? numericQuantity : 1;
  const selectVariant = (sku: string) => { setVariantSku(sku); setAdded(false); };
  const stepQuantity = (delta: number) => setQuantityInput(String(Math.max(1, quantity + delta)));
  const changeQuantity = (event: ChangeEvent<HTMLInputElement>) => setQuantityInput(event.target.value.replace(/[^0-9]/g, "").slice(0, 6));
  const normalizeQuantity = () => setQuantityInput(String(Math.max(1, Number(quantityInput) || 1)));
  const add = () => {
    const finalQuantity = Math.max(quantity, 1);
    setQuantityInput(String(finalQuantity));
    addSelection({ sku: product.sku, variantSku, title: product.title, image: images[0] || null, quantity: finalQuantity, moqUnits: null, price: displayPrice });
    setAdded(true);
  };

  return <div className="product-detail-grid">
    <div className="gallery"><div className="gallery-main">{activeImage ? <img src={activeImage} alt={product.title} /> : <div className="image-placeholder">HJ</div>}</div>{images.length > 1 && <div className="gallery-thumbs">{images.slice(0, 12).map((image, index) => <button type="button" key={image} className={image === activeImage ? "active" : ""} onClick={() => setActiveImage(image)} aria-label={`View image ${index + 1}`}><img src={image} alt="" loading="lazy" /></button>)}</div>}</div>
    <div className="product-info">
      <div className="product-info-top"><span>{product.category}</span>{product.isNew && <span className="badge badge-new">New</span>}</div>
      <h1>{product.title}</h1><p className="product-sku">SKU {product.sku}</p>
      <div className="detail-price"><strong>{displayPrice == null ? "Request price" : `$${displayPrice.toFixed(2)}`}</strong>{displayPrice != null && <span>USD · final quote confirmed by sales</span>}</div>
      <p className="product-description">{product.description}</p>
      <dl className="product-facts"><div><dt>Material</dt><dd>Stainless Steel</dd></div><div><dt>Color</dt><dd>{product.colors.join(", ") || "See product photos"}</dd></div><div><dt>Style</dt><dd>{product.styles.join(", ") || "Wholesale collection"}</dd></div><div><dt>Ordering</dt><dd>No MOQ · Mix & match</dd></div></dl>
      {product.variants.length > 0 && <label className="variant-select"><span>Select style <small>{product.variants.length} options</small></span><select value={variantSku} onChange={(event) => selectVariant(event.target.value)}>{product.variants.map((item) => <option key={item.sku} value={item.sku}>{item.name} · {item.sku}</option>)}</select></label>}
      <div className="selected-variant"><span>Selected</span><strong>{variant?.name || product.title}</strong><span>{variantSku}</span><span>No MOQ · Mixable</span></div>
      <div className="quantity-row"><div><span>Quantity</span><small>No minimum · mix any styles</small></div><div className="stepper"><button type="button" onClick={() => stepQuantity(-1)} aria-label="Decrease quantity"><Minus /></button><input value={quantityInput} onChange={changeQuantity} onBlur={normalizeQuantity} inputMode="numeric" aria-label="Quantity" min={1} /><button type="button" onClick={() => stepQuantity(1)} aria-label="Increase quantity"><Plus /></button></div></div>
      <div className="product-add-actions"><button type="button" className={`button product-add ${added ? "is-added" : ""}`} onClick={add}>{added ? <><Check />Added to selection</> : <><ListPlus />Add to selection</>}</button>{added && <Link href="/selection" className="text-link">View selection</Link>}</div>
      <div className="mix-note"><strong>Mix & match wholesale</strong><p>Add different products and variants to one selection, then request a combined quote.</p></div>
    </div>
  </div>;
}
