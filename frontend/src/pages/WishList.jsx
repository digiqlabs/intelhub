import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sparkles, Wand2 } from "lucide-react";

import StatusChip from "../components/StatusChip";
import ToastStack from "../components/ToastStack";
import WishModal from "../components/WishModal";
import useToast from "../hooks/useToast";
import {
  deleteWish,
  listCompetitors,
  listMasterProducts,
  listVendors,
  listWishlist,
  patchWishStatus,
  patchWishVendor,
  patchWishMasterProduct
} from "../lib/api";

const STATUS_FILTERS = [{ label: "All statuses", value: "" }, ...[
  "planned",
  "sourcing",
  "ordered",
  "procured",
  "abandoned"
].map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value }))];

const normalize = (value = "") => value.toLowerCase().trim();
const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

function WishListPage() {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [competitorFilter, setCompetitorFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [masterProductFilter, setMasterProductFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [competitorOptions, setCompetitorOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);

  const [refreshToken, setRefreshToken] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);

  const [statusUpdating, setStatusUpdating] = useState(null);
  const [vendorUpdating, setVendorUpdating] = useState(null);
  const [masterProductUpdating, setMasterProductUpdating] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const { toasts, push, dismiss } = useToast();

  const vendorLookup = useMemo(() => {
    const map = new Map();
    vendorOptions.forEach((vendor) => {
      map.set(vendor.vendor_id, vendor);
    });
    return map;
  }, [vendorOptions]);

  const masterProductLookup = useMemo(() => {
    const map = new Map();
    masterProducts.forEach((product) => {
      map.set(product.product_id, product);
    });
    return map;
  }, [masterProducts]);

  const sortedMasterProducts = useMemo(() => {
    return ensureArray(masterProducts)
      .slice()
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
  }, [masterProducts]);

  const filteredWishes = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return wishes;

    return wishes.filter((wish) => {
      const vendorName = wish.vendor_id ? vendorLookup.get(wish.vendor_id)?.name ?? "" : "";
      const masterProduct = wish.master_product_id
        ? masterProductLookup.get(wish.master_product_id)
        : undefined;
      const haystack = [
        wish.title,
        wish.description,
        wish.notes,
        wish.status,
        vendorName,
        masterProduct?.name,
        masterProduct?.product_type,
        masterProduct?.metal,
        ...(wish.tags ?? []),
        ...(wish.competitors ?? []),
        ...(wish.source_platforms ?? []),
        ...(wish.reference_urls ?? [])
      ]
        .filter(Boolean)
        .map((value) => normalize(String(value)));

      return haystack.some((value) => value.includes(term));
    });
  }, [wishes, searchTerm, vendorLookup, masterProductLookup]);

  const totalCount = wishes.length;
  const visibleCount = filteredWishes.length;

  const fetchFilters = useCallback(async () => {
    try {
      const [competitors, vendors, masterProductsResponse] = await Promise.all([
        listCompetitors(),
        listVendors(),
        listMasterProducts()
      ]);
      const competitorList = ensureArray(competitors)
        .map((item) => (typeof item === "string" ? item : item?.business_name))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setCompetitorOptions(competitorList);
      setVendorOptions(ensureArray(vendors));
      setMasterProducts(ensureArray(masterProductsResponse));
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 405 || !err.response) {
        setCompetitorOptions([]);
        setVendorOptions([]);
        setMasterProducts([]);
        setApiUnavailable(true);
        return;
      }
      push({
        variant: "error",
        title: "Unable to load filters",
        description: err.response?.data?.detail || err.message || "Unknown error"
      });
    }
  }, [push]);

  const fetchWishes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWishlist({
        status: statusFilter || undefined,
        competitor: competitorFilter || undefined,
        vendor_id: vendorFilter || undefined,
        master_product_id: masterProductFilter || undefined,
        tag: tagFilter || undefined
      });
      setWishes(ensureArray(data));
      setApiUnavailable(false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 405 || !err.response) {
        setWishes([]);
        setError(null);
        setApiUnavailable(true);
      } else {
        setError(err.response?.data?.detail || err.message || "Unable to load wish list");
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, competitorFilter, vendorFilter, masterProductFilter, tagFilter, refreshToken]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchWishes();
  }, [fetchWishes]);

  const handleAddWish = () => {
    setEditingWish(null);
    setModalOpen(true);
  };

  const handleEditWish = (wish) => {
    setEditingWish(wish);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingWish(null);
  };

  const handleWishSaved = (_, { mode }) => {
    push({
      variant: "success",
      title: mode === "updated" ? "Wish updated" : "Wish captured",
      description: "Your wishlist is now up to date."
    });
    setModalOpen(false);
    setEditingWish(null);
    setRefreshToken((value) => value + 1);
  };

  const handleDelete = async (wish) => {
    const confirmed = window.confirm(`Delete \"${wish.title}\"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(wish.wish_id);
    try {
      await deleteWish(wish.wish_id);
      push({ variant: "success", title: "Wish deleted" });
      setRefreshToken((value) => value + 1);
    } catch (err) {
      push({
        variant: "error",
        title: "Unable to delete",
        description: err.response?.data?.detail || err.message || "Unknown error"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (wish, newStatus) => {
    if (!newStatus || newStatus === wish.status) return;
    setStatusUpdating(wish.wish_id);
    try {
      await patchWishStatus(wish.wish_id, { status: newStatus, price_actual: wish.price_actual ?? null });
      push({ variant: "success", title: "Status updated" });
      setRefreshToken((value) => value + 1);
    } catch (err) {
      push({
        variant: "error",
        title: "Status update failed",
        description: err.response?.data?.detail || err.message || "Unknown error"
      });
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleVendorLink = async (wish, vendorIdValue) => {
    if (vendorIdValue === wish.vendor_id) return;
    setVendorUpdating(wish.wish_id);
    try {
      await patchWishVendor(wish.wish_id, { vendor_id: vendorIdValue || null });
      push({ variant: "success", title: "Vendor updated" });
      setRefreshToken((value) => value + 1);
    } catch (err) {
      push({
        variant: "error",
        title: "Unable to link vendor",
        description: err.response?.data?.detail || err.message || "Unknown error"
      });
    } finally {
      setVendorUpdating(null);
    }
  };

  const handleMasterProductLink = async (wish, productIdValue) => {
    if ((wish.master_product_id || "") === productIdValue) return;
    setMasterProductUpdating(wish.wish_id);
    try {
      await patchWishMasterProduct(wish.wish_id, { master_product_id: productIdValue || null });
      push({ variant: "success", title: productIdValue ? "Master product linked" : "Master product cleared" });
      setRefreshToken((value) => value + 1);
    } catch (err) {
      push({
        variant: "error",
        title: "Unable to link master product",
        description: err.response?.data?.detail || err.message || "Unknown error"
      });
    } finally {
      setMasterProductUpdating(null);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-10 shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-6 text-slate-200">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.45em] text-slate-500">
              <Sparkles className="h-4 w-4" /> Wish list
            </p>
            <h1 className="text-3xl font-semibold text-white">Inspired sourcing queue</h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Capture products you love, track sourcing progress, and bring the next drop to life faster.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddWish}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <Wand2 className="h-4 w-4" /> Add wish
          </button>
        </div>

  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-2 text-sm text-slate-200">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            <span>Competitor</span>
            <select
              value={competitorFilter}
              onChange={(event) => setCompetitorFilter(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">All competitors</option>
              {competitorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            <span>Vendor</span>
            <select
              value={vendorFilter}
              onChange={(event) => setVendorFilter(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">All vendors</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.vendor_id} value={vendor.vendor_id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            <span>Master product</span>
            <select
              value={masterProductFilter}
              onChange={(event) => setMasterProductFilter(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">All master products</option>
              {sortedMasterProducts.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            <span>Tag contains</span>
            <input
              type="search"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Search tags…"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search wishes by title, notes, tags…"
              className="w-full rounded-full border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>

          <p className="text-xs text-slate-500 md:text-right">
            Showing {visibleCount} of {totalCount} wish{totalCount === 1 ? "" : "es"}
          </p>
        </div>
      </header>

      {apiUnavailable && !loading && (
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
          <p className="font-semibold">Wishlist API not available</p>
          <p className="mt-1 text-amber-100/80">
            We couldn&apos;t find the wishlist endpoints on the backend. Make sure you&apos;re running the latest FastAPI
            service that includes the wishlist and vendor routes. Until then, this board will stay empty.
          </p>
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/60 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300 hover:text-white"
          >
            Retry now
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading wish list…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-10 text-rose-100">
          <p className="text-base font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
        </div>
      )}

      {!loading && !error && !apiUnavailable && visibleCount === 0 && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/50 p-12 text-center text-slate-400">
          <p>
            {totalCount === 0
              ? "No wishlist items match the current filters."
              : "No wishlist items match the current search keywords."}
          </p>
          {totalCount === 0 && (
            <p className="mt-2 text-sm">Capture your first inspired product by clicking “Add wish”.</p>
          )}
        </div>
      )}

      {!loading && !error && !apiUnavailable && visibleCount > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 drop-shadow-panel">
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-950/40">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.35em] text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Wish
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Competitors
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Vendor
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Master product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Pricing
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Tags
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredWishes.map((wish) => {
                  const isStatusBusy = statusUpdating === wish.wish_id;
                  const isVendorBusy = vendorUpdating === wish.wish_id;
                  const isMasterProductBusy = masterProductUpdating === wish.wish_id;
                  const isDeleting = deletingId === wish.wish_id;
                  const vendor = wish.vendor_id ? vendorLookup.get(wish.vendor_id) : undefined;
                  const masterProduct = wish.master_product_id
                    ? masterProductLookup.get(wish.master_product_id)
                    : undefined;
                  const tags = wish.tags ?? [];
                  const competitors = wish.competitors ?? [];
                  const sourcePlatforms = wish.source_platforms ?? [];

                  return (
                    <tr key={wish.wish_id} className="hover:bg-slate-900/60">
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-100">{wish.title}</p>
                          {wish.description && (
                            <p className="text-xs text-slate-400">{wish.description}</p>
                          )}
                          {sourcePlatforms.length > 0 && (
                            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                              {sourcePlatforms.join(" · ")}
                            </p>
                          )}
                          {wish.notes && (
                            <p className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                              {wish.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <div className="flex flex-wrap gap-2">
                          {competitors.length === 0 && <span className="text-slate-500">–</span>}
                          {competitors.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-xs"
                            >
                              #{name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <StatusChip status={wish.status} />
                          <select
                            value={wish.status}
                            onChange={(event) => handleStatusChange(wish, event.target.value)}
                            disabled={isStatusBusy}
                            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.2em] focus:border-emerald-400 focus:outline-none"
                          >
                            {STATUS_FILTERS.filter((option) => option.value !== "").map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <select
                          value={wish.vendor_id ?? ""}
                          onChange={(event) => handleVendorLink(wish, event.target.value)}
                          disabled={isVendorBusy}
                          className="w-full rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs focus:border-emerald-400 focus:outline-none"
                        >
                          <option value="">No vendor linked</option>
                          {vendorOptions.map((option) => (
                            <option key={option.vendor_id} value={option.vendor_id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        {vendor && (
                          <p className="mt-2 text-[0.7rem] text-slate-500">
                            {vendor.city ? `${vendor.city}${vendor.country ? ", " : ""}` : ""}
                            {vendor.country ?? ""}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <select
                          value={wish.master_product_id ?? ""}
                          onChange={(event) => handleMasterProductLink(wish, event.target.value)}
                          disabled={isMasterProductBusy}
                          className="w-full rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs focus:border-emerald-400 focus:outline-none"
                        >
                          <option value="">No master product linked</option>
                          {sortedMasterProducts.map((product) => (
                            <option key={product.product_id} value={product.product_id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                        {masterProduct && (
                          <div className="mt-2 space-y-1 text-[0.7rem] text-slate-500">
                            {masterProduct.product_type && <p>Type: {masterProduct.product_type}</p>}
                            {masterProduct.metal && <p>Metal: {masterProduct.metal}</p>}
                            {masterProduct.description && (
                              <p className="text-slate-400">{masterProduct.description}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <div className="space-y-1">
                          <p>{wish.price_target ? `Target ₹${wish.price_target}` : "No target"}</p>
                          <p>{wish.price_actual ? `Actual ₹${wish.price_actual}` : "Not procured"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <div className="flex flex-wrap gap-2">
                          {tags.length === 0 && <span className="text-slate-500">–</span>}
                          {tags.map((tag) => (
                            <span key={tag} className="rounded-full border border-slate-700/70 px-3 py-1 text-xs">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleEditWish(wish)}
                            className="rounded-full border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(wish)}
                            disabled={isDeleting}
                            className="rounded-full border border-rose-500/60 px-4 py-2 font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-60"
                          >
                            {isDeleting ? "Removing…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <WishModal open={modalOpen} onClose={handleModalClose} onSaved={handleWishSaved} initialWish={editingWish} />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default WishListPage;
