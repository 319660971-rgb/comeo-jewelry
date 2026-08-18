"use client";

import Link from "next/link";
import { Menu, Search, X, ListPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { SelectionCount } from "./SelectionCount";

const nav = [
  ["New Arrivals", "/catalog?sort=newest"],
  ["Shop All", "/catalog"],
  ["Rings", "/collections/rings"],
  ["Earrings", "/collections/earrings"],
  ["Necklaces", "/collections/necklaces-and-chains"],
  ["Bracelets", "/collections/bracelets-and-bangles"],
  ["Store Solution", "/wholesale"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const toggleMenu = () => {
    setOpen((current) => !current);
    setSearchOpen(false);
  };
  const toggleSearch = () => {
    setSearchOpen((current) => !current);
    setOpen(false);
  };
  return (
    <header className="site-header">
      <div className="benefit-strip" aria-label="Wholesale benefits">
        <span>No MOQ</span><span>Mix & Match</span><span>Fresh Designs</span><span>Global Wholesale</span>
      </div>
      <div className="header-main">
        <button type="button" className="icon-button mobile-only" onClick={toggleMenu} aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
        <Link href="/" className="wordmark" aria-label="Hello Jewelry home"><BrandMark /></Link>
        <form id="header-search" className={`header-search ${searchOpen ? "is-open" : ""}`} action="/catalog">
          <button type="submit" className="header-search-submit" aria-label="Search"><Search size={18} aria-hidden="true" /></button>
          <input name="q" placeholder="Search SKU, style or material" aria-label="Search wholesale catalog" />
        </form>
        <div className="header-actions">
          <button type="button" className="icon-button search-toggle" onClick={toggleSearch} aria-expanded={searchOpen} aria-controls="header-search" aria-label={searchOpen ? "Close search" : "Open search"}>{searchOpen ? <X /> : <Search />}</button>
          <Link href="/selection" className="selection-link" aria-label="Open selection list"><ListPlus /><span className="desktop-label">Selection</span><SelectionCount /></Link>
        </div>
      </div>
      <nav id="primary-navigation" className={`main-nav ${open ? "is-open" : ""}`} aria-label="Primary navigation">
        {nav.map(([label, href]) => <Link key={href} href={href} onClick={() => { setOpen(false); setSearchOpen(false); }}>{label}</Link>)}
      </nav>
      {open && <button type="button" className="nav-backdrop" aria-label="Close navigation overlay" onClick={() => setOpen(false)} />}
    </header>
  );
}
