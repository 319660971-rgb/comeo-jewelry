import { AccessForm } from "@/components/AccessForm";
import { CheckCircle2 } from "lucide-react";
import { getProducts } from "@/lib/catalog";

export const metadata = { title: "Wholesale Catalog Access", robots: { index: false, follow: false } };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const destination = from?.startsWith("/") ? from : "/catalog";
  const productCount = getProducts().length;
  return <section className="access-page"><div className="access-visual" style={{ backgroundImage: "url('/media/products/268137/01.jpg')" }}><div className="access-visual-copy"><p className="eyebrow">Hello Jewelry buyer access</p><h1>More styles. Smaller tests. Smarter wholesale.</h1><ul><li><CheckCircle2 />{productCount} stainless steel products across key categories</li><li><CheckCircle2 />No MOQ and mixed style selections</li><li><CheckCircle2 />Direct WhatsApp support for quotes</li></ul></div></div><div className="access-content"><p className="eyebrow">Wholesale buyers</p><h2>Unlock the full catalog</h2><p>Tell us where to reach you. You will get immediate access without creating an account.</p><AccessForm destination={destination} /></div></section>;
}
