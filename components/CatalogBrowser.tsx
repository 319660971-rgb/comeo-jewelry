"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "./ProductCard";
import { CatalogSummary } from "@/lib/types";

type Filters = { categories: string[]; colors: string[]; styles: string[] };
type ApiResult = { items: CatalogSummary[]; total: number; page: number; hasMore: boolean; filters: Filters };
type FilterState = { query: string; category: string; color: string; style: string; price: string; sort: string };

function readState(searchParams: URLSearchParams, initialCategory: string, initialQuery: string, initialSort: string): FilterState {
  return {
    query: searchParams.get("q") ?? initialQuery,
    category: initialCategory || searchParams.get("category") || "",
    color: searchParams.get("color") || "",
    style: searchParams.get("style") || "",
    price: searchParams.get("price") || "",
    sort: searchParams.get("sort") || initialSort || "featured",
  };
}

function buildSearch(state: FilterState, page: number) {
  const search = new URLSearchParams({ page: String(page), pageSize: "24" });
  if (state.query) search.set("q", state.query);
  if (state.category) search.set("category", state.category);
  if (state.color) search.set("color", state.color);
  if (state.style) search.set("style", state.style);
  if (state.price) search.set("price", state.price);
  if (state.sort) search.set("sort", state.sort);
  return search;
}

export function CatalogBrowser({ initialCategory = "", initialQuery = "", initialSort = "featured" }: { initialCategory?: string; initialQuery?: string; initialSort?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialState = useMemo(() => readState(new URLSearchParams(searchParams.toString()), initialCategory, initialQuery, initialSort), [searchParams, initialCategory, initialQuery, initialSort]);
  const [committed, setCommitted] = useState<FilterState>(initialState);
  const [draftQuery, setDraftQuery] = useState(initialState.query);
  const [mobileDraft, setMobileDraft] = useState(initialState);
  const [items, setItems] = useState<CatalogSummary[]>([]);
  const [filters, setFilters] = useState<Filters>({ categories: [], colors: [], styles: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    // URL navigation is external state; mirror it into the interactive controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommitted(initialState);
    setDraftQuery(initialState.query);
    setMobileDraft(initialState);
  }, [initialState]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawer]);

  const syncUrl = useCallback((next: FilterState) => {
    const query = new URLSearchParams();
    if (next.query) query.set("q", next.query);
    if (!initialCategory && next.category) query.set("category", next.category);
    if (next.color) query.set("color", next.color);
    if (next.style) query.set("style", next.style);
    if (next.price) query.set("price", next.price);
    if (next.sort && next.sort !== "featured") query.set("sort", next.sort);
    router.replace(`${pathname}${query.toString() ? `?${query.toString()}` : ""}`, { scroll: false });
  }, [initialCategory, pathname, router]);

  const commit = useCallback((changes: Partial<FilterState>) => {
    const next = { ...committed, ...changes };
    setCommitted(next);
    syncUrl(next);
  }, [committed, syncUrl]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch(`/api/products?${buildSearch(committed, 1)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load catalog.");
        return await response.json() as ApiResult;
      })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setFilters(data.filters);
        setTotal(data.total);
        setPage(1);
        setHasMore(data.hasMore);
      })
      .catch((reason: unknown) => {
        if (active && !(reason instanceof DOMException && reason.name === "AbortError")) setError("Unable to load the catalog. Please try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [committed]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/products?${buildSearch(committed, page + 1)}`);
      if (!response.ok) throw new Error("Unable to load more products.");
      const data = await response.json() as ApiResult;
      setItems((current) => [...current, ...data.items]);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch {
      setError("Unable to load more products. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const clearState: Partial<FilterState> = { category: initialCategory, color: "", style: "", price: "" };
  const activeCount = [committed.color, committed.style, committed.price, !initialCategory ? committed.category : ""].filter(Boolean).length;
  const clearDesktop = () => commit(clearState);
  const updateDesktop = (key: keyof FilterState, value: string) => commit({ [key]: value } as Partial<FilterState>);
  const openDrawer = () => { setMobileDraft(committed); setDrawer(true); };
  const updateMobile = (key: keyof FilterState, value: string) => setMobileDraft((current) => ({ ...current, [key]: value }));
  const applyMobile = () => { commit(mobileDraft); setDrawer(false); };

  const filterPanel = (state: FilterState, onChange: (key: keyof FilterState, value: string) => void, mobile = false) => {
    const panelActiveCount = [state.color, state.style, state.price, !initialCategory ? state.category : ""].filter(Boolean).length;
    return (
    <div className="filter-panel-inner">
      <div className="filter-heading"><strong>Filters</strong>{panelActiveCount > 0 && <button type="button" onClick={() => mobile ? setMobileDraft((current) => ({ ...current, ...clearState })) : clearDesktop()}>Clear all</button>}{mobile && <button type="button" className="icon-button mobile-only" onClick={() => setDrawer(false)} aria-label="Close filters"><X /></button>}</div>
      {!initialCategory && <FilterSelect label="Category" value={state.category} onChange={(value) => onChange("category", value)} options={filters.categories.filter((item) => item !== "All").map((item) => [slugify(item), item])} defaultLabel="All categories" />}
      <FilterSelect label="Color" value={state.color} onChange={(value) => onChange("color", value)} options={filters.colors.map((item) => [item, item])} defaultLabel="All colors" />
      <FilterSelect label="Style" value={state.style} onChange={(value) => onChange("style", value)} options={filters.styles.map((item) => [item, item])} defaultLabel="All styles" />
      <FilterSelect label="Price" value={state.price} onChange={(value) => onChange("price", value)} options={[["available", "Price available"], ["request", "Request price"]]} defaultLabel="All price states" />
      <div className="wholesale-note"><span>No MOQ · Mixed wholesale</span><p>Combine any stainless steel SKUs and styles in one selection.</p></div>
      {mobile && <button type="button" className="button button-accent filter-apply" onClick={applyMobile}>Apply filters</button>}
    </div>
    );
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit({ query: draftQuery.trim() });
  };

  return (
    <div className="catalog-browser">
      <div className="catalog-toolbar">
        <button type="button" className="filter-mobile-button" onClick={openDrawer} aria-expanded={drawer} aria-controls="mobile-filters"><SlidersHorizontal size={18} />Filters{activeCount > 0 && ` (${activeCount})`}</button>
        <form onSubmit={submitSearch} className="catalog-search"><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search SKU or product" /><button type="submit">Search</button></form>
        <span className="result-count">{loading && items.length === 0 ? "Loading…" : `${total} products`}</span>
        <label className="sort-control"><span>Sort by</span><select value={committed.sort} onChange={(event) => commit({ sort: event.target.value })}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option></select></label>
      </div>
      <div className="catalog-layout">
        <aside className="filter-panel">{filterPanel(committed, updateDesktop)}</aside>
        <main aria-busy={loading}>
          {error && <div className="filter-error" role="alert">{error}</div>}
          {items.length ? <div className="product-grid">{items.map((product, index) => <ProductCard key={product.sku} product={product} priority={index < 4} />)}</div> : !loading && <div className="empty-state"><h2>No matching styles</h2><p>Try removing a filter or searching by SKU.</p><button type="button" onClick={() => commit({ ...clearState, query: "" })} className="button button-dark">Reset filters</button></div>}
          {loading && <div className="loading-line">Loading wholesale styles…</div>}
          {hasMore && !loading && <button type="button" className="load-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more products"}</button>}
        </main>
      </div>
      {drawer && <div id="mobile-filters" className="filter-drawer" role="dialog" aria-modal="true" aria-label="Catalog filters"><button type="button" className="drawer-backdrop" onClick={() => setDrawer(false)} aria-label="Close filters" />{filterPanel(mobileDraft, updateMobile, true)}</div>}
    </div>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FilterSelect({ label, value, onChange, options, defaultLabel }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; defaultLabel: string }) {
  return <label className="filter-group"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{defaultLabel}</option>{options.map(([optionValue, text]) => <option key={`${label}-${optionValue}`} value={optionValue}>{text}</option>)}</select></label>;
}
