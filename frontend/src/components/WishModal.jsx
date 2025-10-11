import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, Save } from "lucide-react";

import Modal from "./Modal";
import TagPicker from "./TagPicker";
import {
  createWish,
  listCompetitors,
  listMasterProducts,
  listVendors,
  updateWish
} from "../lib/api";

const STATUS_OPTIONS = ["planned", "sourcing", "ordered", "procured", "abandoned"];
const PLATFORM_OPTIONS = ["instagram", "facebook", "youtube", "tiktok", "pinterest", "website"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

const normalizeList = (value = "") =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const numberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const formatErrorDetail = (detail) => {
  if (!detail) return null;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const path = Array.isArray(item.loc) ? item.loc.slice(1).join(" → ") : null;
          if (item.msg && path) return `${path}: ${item.msg}`;
          if (item.msg) return item.msg;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join(". ");
  }

  if (typeof detail === "object") {
    return Object.entries(detail)
      .map(([key, value]) => `${key}: ${value}`)
      .join(". ");
  }

  return String(detail);
};

function WishModal({
  open,
  onClose,
  onSaved,
  initialWish = null,
  prefillCompetitors,
  prefillReferenceUrls
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [referenceUrlsText, setReferenceUrlsText] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [status, setStatus] = useState("planned");
  const [priceTarget, setPriceTarget] = useState("");
  const [priceActual, setPriceActual] = useState("");
  const [tagSlugs, setTagSlugs] = useState([]);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("medium");
  const [vendorId, setVendorId] = useState("");
  const [masterProductId, setMasterProductId] = useState("");

  const [competitorOptions, setCompetitorOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [masterProductOptions, setMasterProductOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEditMode = Boolean(initialWish);

  const computedPrefillCompetitors = useMemo(
    () => (Array.isArray(prefillCompetitors) ? prefillCompetitors : []),
    [prefillCompetitors]
  );

  const computedPrefillReferenceUrls = useMemo(
    () => (Array.isArray(prefillReferenceUrls) ? prefillReferenceUrls : []),
    [prefillReferenceUrls]
  );

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoadingOptions(true);

    Promise.all([listCompetitors(), listVendors(), listMasterProducts()])
      .then(([competitors, vendors, masterProducts]) => {
        if (!active) return;
        const competitorNames = ensureArray(competitors)
          .map((item) => (typeof item === "string" ? item : item?.business_name))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setCompetitorOptions(competitorNames);
        setVendorOptions(ensureArray(vendors));
        setMasterProductOptions(ensureArray(masterProducts));
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.detail || err.message || "Unable to load options");
        setMasterProductOptions([]);
      })
      .finally(() => {
        if (active) {
          setLoadingOptions(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (initialWish) {
      setTitle(initialWish.title ?? "");
      setDescription(initialWish.description ?? "");
      setReferenceUrlsText((initialWish.reference_urls ?? []).join("\n"));
      setSelectedCompetitors(initialWish.competitors ?? []);
      setSelectedPlatforms(initialWish.source_platforms ?? []);
      setStatus(initialWish.status ?? "planned");
      setPriceTarget(initialWish.price_target ?? "");
      setPriceActual(initialWish.price_actual ?? "");
      setTagSlugs((initialWish.tags ?? []).filter(Boolean));
      setNotes(initialWish.notes ?? "");
      setPriority(initialWish.priority ?? "medium");
      setVendorId(initialWish.vendor_id ?? "");
      setMasterProductId(initialWish.master_product_id ?? "");
    } else {
      setTitle("");
      setDescription("");
      setReferenceUrlsText(computedPrefillReferenceUrls.join("\n"));
      setSelectedCompetitors(computedPrefillCompetitors);
      setSelectedPlatforms([]);
      setStatus("planned");
      setPriceTarget("");
      setPriceActual("");
      setTagSlugs([]);
      setNotes("");
      setPriority("medium");
      setVendorId("");
      setMasterProductId("");
    }
    setError(null);
  }, [open, initialWish, computedPrefillCompetitors, computedPrefillReferenceUrls]);

  const sortedMasterProducts = useMemo(() =>
    ensureArray(masterProductOptions)
      .slice()
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || "")),
  [masterProductOptions]);

  const titlePlaceholder = useMemo(
    () => (initialWish ? "Update wishlist item" : "Describe the inspired product"),
    [initialWish]
  );

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((entry) => entry !== platform) : [...prev, platform]
    );
  };

  const handleCompetitorSelect = (event) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedCompetitors(values);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      reference_urls: normalizeList(referenceUrlsText),
      images: initialWish?.images ?? [],
      source_platforms: selectedPlatforms,
      competitors: selectedCompetitors,
      vendor_id: vendorId || null,
      master_product_id: masterProductId || null,
      status,
      price_target: numberOrNull(priceTarget),
      price_actual: status === "procured" ? numberOrNull(priceActual) : null,
      tags: tagSlugs,
      priority,
      notes: notes.trim() || null
    };

    setSubmitting(true);
    setError(null);

    try {
      const result = isEditMode
        ? await updateWish(initialWish.wish_id, payload)
        : await createWish(payload);

      onSaved?.(result, { mode: isEditMode ? "updated" : "created" });
      onClose?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(formatErrorDetail(detail) || err.message || "Unable to save wishlist item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditMode ? "Edit wish" : "Add to wish list"} widthClass="max-w-4xl">
      <form onSubmit={handleSubmit} className="grid gap-6">
        {error && (
          <p className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={titlePlaceholder}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What makes this product interesting?"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Reference URLs</span>
            <textarea
              value={referenceUrlsText}
              onChange={(event) => setReferenceUrlsText(event.target.value)}
              rows={4}
              placeholder="Paste reels or product links (comma or newline separated)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Competitors linked</span>
            <select
              multiple
              value={selectedCompetitors}
              onChange={handleCompetitorSelect}
              disabled={loadingOptions}
              className="min-h-[160px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              {competitorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">Hold Ctrl/Cmd to select multiple.</span>
          </label>
        </div>

        <fieldset className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <legend className="px-2 text-xs uppercase tracking-[0.3em] text-slate-500">Source platforms</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((platform) => {
              const isActive = selectedPlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handlePlatformToggle(platform)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Price target</span>
            <input
              type="number"
              min="0"
              value={priceTarget}
              onChange={(event) => setPriceTarget(event.target.value)}
              placeholder="1500"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Vendor</span>
            <select
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              disabled={loadingOptions}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">No vendor linked</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.vendor_id} value={vendor.vendor_id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Master product</span>
            <select
              value={masterProductId}
              onChange={(event) => setMasterProductId(event.target.value)}
              disabled={loadingOptions}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">No master product linked</option>
              {sortedMasterProducts.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.name}
                  {product.product_type ? ` · ${product.product_type}` : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">Optional link to the catalog entry for this idea.</span>
          </label>
        </div>

        {status === "procured" && (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Actual landed cost</span>
            <input
              type="number"
              min="0"
              value={priceActual}
              onChange={(event) => setPriceActual(event.target.value)}
              placeholder="1485"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
        )}

        <label className="grid gap-3">
          <div>
            <span className="text-sm font-medium text-slate-200">Tags</span>
            <p className="text-xs text-slate-500">Select canonical tags for faster discovery and analytics.</p>
          </div>
          <TagPicker value={tagSlugs} onChange={setTagSlugs} entityType="wishlist" />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Internal notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Any sourcing steps, material notes, or finish requirements"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditMode ? (
              <Save className="h-4 w-4" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            {submitting ? "Saving…" : isEditMode ? "Save changes" : "Add wish"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default WishModal;
