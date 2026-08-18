import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link href="/" className="wordmark wordmark-footer" aria-label="Hello Jewelry home"><BrandMark /></Link>
        <p>Store-ready stainless steel jewelry assortments for growing retailers.</p>
      </div>
      <div><h2>Wholesale</h2><Link href="/catalog">Browse catalog</Link><Link href="/wholesale">Build my assortment</Link><Link href="/selection">Selection list</Link></div>
      <div><h2>Shop by</h2><Link href="/collections/rings">Rings</Link><Link href="/collections/earrings">Earrings</Link><Link href="/collections/necklaces-and-chains">Necklaces</Link></div>
      <div><h2>Contact</h2><p>WhatsApp-first support</p><p>Email quotes available</p><p>English service worldwide</p></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Hello Jewelry</span><span>Wholesale catalog · Prices subject to final confirmation</span></div>
    </footer>
  );
}
