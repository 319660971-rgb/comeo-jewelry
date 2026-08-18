"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { readSelection, writeSelection } from "@/lib/selection";
import { SelectionItem } from "@/lib/types";

type Contact = { name?: string; company?: string; country?: string; whatsapp?: string; email?: string };

export function SelectionPageClient() {
  const [items, setItems] = useState<SelectionItem[]>([]);
  const [contact, setContact] = useState<Contact>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [quoteId, setQuoteId] = useState("");

  useEffect(() => {
    // Selection and contact details are browser-owned state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readSelection());
    try {
      setContact(JSON.parse(window.localStorage.getItem("hello-jewelry-contact") || "{}"));
    } catch {
      setContact({});
    }
    setHydrated(true);
  }, []);

  const update = (next: SelectionItem[]) => { setItems(next); writeSelection(next); };
  const updateQuantity = (variantSku: string, quantity: number) => update(items.map((entry) => entry.variantSku === variantSku ? { ...entry, quantity } : entry));
  const estimated = useMemo(() => items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0), [items]);
  const hasRequestPrice = items.some((item) => item.price == null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), company: form.get("company"), country: form.get("country"), whatsapp: form.get("whatsapp"), email: form.get("email"), note: form.get("note"), items };
    try {
      const response = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your quote.");
      setQuoteId(data.quoteId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit your quote.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) return <div className="selection-empty"><p className="eyebrow">Mixed wholesale selection</p><p>Loading your selection…</p></div>;
  if (!items.length && !quoteId) return <div className="selection-empty"><p className="eyebrow">Mixed wholesale selection</p><h1>Your selection is empty</h1><p>Browse the catalog and add the styles you want us to quote.</p><Link href="/catalog" className="button button-dark">Browse wholesale catalog <ArrowRight /></Link></div>;
  if (quoteId) {
    const skus = items.map((item) => `${item.variantSku} x ${item.quantity}`).join(", ");
    const message = encodeURIComponent(`Hello Jewelry quote ${quoteId}. My selected styles: ${skus}`);
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    return <div className="quote-success"><p className="eyebrow">Quote submitted</p><h1>We received your selection.</h1><div className="quote-id">{quoteId}</div><p>We will confirm availability and final price for your mixed selection.</p>{number ? <a className="button button-accent" href={`https://wa.me/${number}?text=${message}`} target="_blank" rel="noreferrer">Continue on WhatsApp <ArrowRight /></a> : <p className="form-footnote">WhatsApp follow-up will be available after the sales number is connected.</p>}<Link href="/catalog" className="text-link">Keep browsing</Link></div>;
  }

  return <div className="selection-page"><div className="selection-title"><p className="eyebrow">Mixed wholesale selection</p><div className="selection-title-row"><div><h1>Your selection</h1><p>{items.length} styles · no MOQ · mix any stainless steel styles.</p></div><Link href="/catalog" className="text-link">Continue browsing <ArrowRight /></Link></div></div><div className="selection-layout"><div className="selection-items">{items.map((item) => <article key={item.variantSku} className="selection-item">{item.image ? <img src={item.image} alt={item.title} /> : <div className="image-placeholder">HJ</div>}<div className="selection-item-copy"><h2>{item.title}</h2><p>Variant {item.variantSku}</p><p>No MOQ · Mixable</p><strong>{item.price == null ? "Request price" : `$${item.price.toFixed(2)} / pc`}</strong></div><div className="selection-item-actions"><SelectionQuantity item={item} onChange={(quantity) => updateQuantity(item.variantSku, quantity)} /><button type="button" className="remove-button" onClick={() => update(items.filter((entry) => entry.variantSku !== item.variantSku))}><Trash2 />Remove</button></div></article>)}</div><aside className="quote-panel"><h2>Request wholesale quote</h2><div className="quote-summary"><span>Selected styles <strong>{items.length}</strong></span><span>Total pieces <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></span><span>Visible price subtotal <strong>{estimated > 0 ? `$${estimated.toFixed(2)}` : "Request price"}</strong></span>{hasRequestPrice && <small>Some styles require price confirmation and are not included in this subtotal.</small>}</div><form onSubmit={submit} className="quote-form"><label><span>Name</span><input name="name" required defaultValue={contact.name} /></label><label><span>Company</span><input name="company" required defaultValue={contact.company} /></label><label><span>Country</span><input name="country" required defaultValue={contact.country} /></label><label><span>WhatsApp</span><input name="whatsapp" required defaultValue={contact.whatsapp} /></label><label><span>Email <small>Optional</small></span><input name="email" type="email" defaultValue={contact.email} /></label><label><span>Notes <small>Optional</small></span><textarea name="note" rows={3} placeholder="Target delivery date, packaging or other requirements" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-accent" disabled={submitting}>{submitting ? "Submitting…" : "Submit selection"}<ArrowRight /></button></form></aside></div></div>;
}

function SelectionQuantity({ item, onChange }: { item: SelectionItem; onChange: (quantity: number) => void }) {
  const [value, setValue] = useState(String(item.quantity));
  // Keep the editable field aligned after a sibling stepper updates the item.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setValue(String(item.quantity)), [item.quantity]);
  const commit = () => {
    const next = Math.max(1, Number(value) || 1);
    setValue(String(next));
    onChange(next);
  };
  return <div className="selection-quantity"><div className="stepper"><button type="button" onClick={() => onChange(Math.max(1, item.quantity - 1))} aria-label="Decrease quantity"><Minus /></button><input value={value} onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} onBlur={commit} inputMode="numeric" min={1} aria-label={`Quantity for ${item.title}`} /><button type="button" onClick={() => onChange(item.quantity + 1)} aria-label="Increase quantity"><Plus /></button></div><small>No minimum</small></div>;
}
