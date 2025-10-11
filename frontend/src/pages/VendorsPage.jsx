import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Factory,
  Loader2,
  Phone,
  PlusCircle,
  Search,
  Star,
  Trash2,
  Webhook
} from "lucide-react";

import Modal from "../components/Modal";
import ToastStack from "../components/ToastStack";
import VendorForm from "../components/VendorForm";
import useToast from "../hooks/useToast";
import { createVendor, deleteVendor, listVendors, updateVendor } from "../lib/api";

function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { toasts, push, dismiss } = useToast();

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await listVendors({
        query: query || undefined,
        tag: tagFilter || undefined
      });
      setVendors(payload);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to load vendors");
    } finally {
      setLoading(false);
    }
  }, [query, tagFilter]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    setPage(1);
  }, [query, tagFilter]);

  useEffect(() => {
    setPage((current) => {
      const maxPage = vendors.length === 0 ? 1 : Math.ceil(vendors.length / pageSize);
      return Math.min(Math.max(current, 1), Math.max(maxPage, 1));
    });
  }, [vendors.length, pageSize]);

  const totalPages = useMemo(() => {
    if (vendors.length === 0) {
      return 1;
    }
    return Math.ceil(vendors.length / pageSize);
  }, [vendors.length, pageSize]);

  const paginatedVendors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return vendors.slice(start, start + pageSize);
  }, [vendors, page, pageSize]);

  const uniqueTags = useMemo(() => {
    const tagSet = new Set();
    vendors.forEach((vendor) => {
      (vendor.tags ?? []).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const openCreateModal = () => {
    setEditingVendor(null);
    setModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
  };

  const handleVendorSubmit = async (payload) => {
    try {
      let savedVendor;
      if (editingVendor) {
        savedVendor = await updateVendor(editingVendor.vendor_id, payload);
        setVendors((current) =>
          current.map((vendor) => (vendor.vendor_id === savedVendor.vendor_id ? savedVendor : vendor))
        );
        push({ variant: "success", title: "Vendor updated" });
      } else {
        savedVendor = await createVendor(payload);
        setVendors((current) => {
          const withoutDuplicate = current.filter((vendor) => vendor.vendor_id !== savedVendor.vendor_id);
          return [savedVendor, ...withoutDuplicate];
        });
        push({ variant: "success", title: "Vendor added" });
      }
      closeModal();
      try {
        await fetchVendors();
      } catch (refreshError) {
        push({
          variant: "error",
          title: "Refresh failed",
          description:
            refreshError.response?.data?.detail ||
            refreshError.message ||
            "Vendor saved, but list could not refresh"
        });
      }
    } catch (err) {
      push({
        variant: "error",
        title: "Save failed",
        description: err.response?.data?.detail || err.message || "Unable to save vendor"
      });
      throw err;
    }
  };

  const handleDelete = async (vendor) => {
    const confirmDelete = window.confirm(`Remove ${vendor.name}? This cannot be undone.`);
    if (!confirmDelete) return;

    setDeletingId(vendor.vendor_id);
    try {
      await deleteVendor(vendor.vendor_id);
      setVendors((current) => current.filter((item) => item.vendor_id !== vendor.vendor_id));
      push({ variant: "success", title: "Vendor removed" });
      try {
        await fetchVendors();
      } catch (refreshError) {
        push({
          variant: "error",
          title: "Refresh failed",
          description:
            refreshError.response?.data?.detail ||
            refreshError.message ||
            "Vendor removed, but list could not refresh"
        });
      }
    } catch (err) {
      push({
        variant: "error",
        title: "Delete failed",
        description: err.response?.data?.detail || err.message || "Unable to delete vendor"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderRating = (rating) => {
    if (rating == null) return <span className="text-xs text-slate-500">Unrated</span>;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
        <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> {rating}/5
      </span>
    );
  };

  const startIndex = vendors.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = vendors.length === 0 ? 0 : Math.min(page * pageSize, vendors.length);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-10 shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-6 text-slate-200">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.45em] text-slate-500">
              <Factory className="h-4 w-4" /> Vendor network
            </p>
            <h1 className="text-3xl font-semibold text-white">Trusted sourcing partners</h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Keep vendor intros, catalog links, payment terms, and notes in one workspace so the next negotiation starts warm.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <PlusCircle className="h-4 w-4" /> Add vendor
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by vendor, city, country…"
              className="w-full rounded-full border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          {tagFilter && (
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className="justify-self-end text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            >
              Clear tag filter
            </button>
          )}
        </div>

        {uniqueTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tags</span>
            {uniqueTags.map((tag) => {
              const isActive = tagFilter === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((value) => (value === tag ? "" : tag))}
                  className={`inline-flex items-center rounded-full px-3 py-1 font-medium transition ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {loading && (
        <div className="flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading vendors…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-10 text-rose-100">
          <p className="text-base font-semibold">Unable to load vendors</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          <button
            type="button"
            onClick={fetchVendors}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
          >
            Refresh
          </button>
        </div>
      )}

      {!loading && !error && vendors.length === 0 && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/50 p-12 text-center text-slate-400">
          <p>No vendors match the current filters.</p>
          <p className="mt-2 text-sm">Log your first sourcing partner with the “Add vendor” action.</p>
        </div>
      )}

      {!loading && !error && vendors.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/50">
            <table className="min-w-full divide-y divide-slate-800/60 text-sm text-slate-200">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-[0.3em] text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">Vendor</th>
                  <th scope="col" className="px-6 py-4 text-left">Location</th>
                  <th scope="col" className="px-6 py-4 text-left">Contact</th>
                  <th scope="col" className="px-6 py-4 text-left">Catalog</th>
                  <th scope="col" className="px-6 py-4 text-left">Terms</th>
                  <th scope="col" className="px-6 py-4 text-left">Lead time</th>
                  <th scope="col" className="px-6 py-4 text-left">MOQ</th>
                  <th scope="col" className="px-6 py-4 text-left">Rating</th>
                  <th scope="col" className="px-6 py-4 text-left">Tags</th>
                  <th scope="col" className="px-6 py-4 text-left">Added</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {paginatedVendors.map((vendor) => {
                  const isDeleting = deletingId === vendor.vendor_id;
                  const location = [vendor.city, vendor.country].filter(Boolean).join(", ") || "–";
                  const whatsappNumber = vendor.whatsapp_link ?? "";
                  const whatsappDialTarget = whatsappNumber
                    ? whatsappNumber.length === 10
                      ? `91${whatsappNumber}`
                      : whatsappNumber
                    : null;
                  const whatsappUrl = whatsappDialTarget ? `https://wa.me/${whatsappDialTarget}` : null;
                  const catalogs = vendor.catalog_urls ?? [];
                  const addedOn = vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : "–";
                  const updatedOn = vendor.updated_at ? new Date(vendor.updated_at).toLocaleDateString() : "–";

                  return (
                    <tr key={vendor.vendor_id} className="hover:bg-slate-900/40">
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-white">{vendor.name}</span>
                          {vendor.website_url && (
                            <a
                              href={vendor.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-200 underline-offset-4 hover:underline"
                            >
                              <Webhook className="h-3 w-3" /> Website
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">{location}</td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        <div className="flex flex-col gap-1 text-xs">
                          {whatsappNumber && (
                            whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-200 underline-offset-4 hover:underline"
                              >
                                <Phone className="h-3 w-3" /> WhatsApp · {whatsappNumber}
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Phone className="h-3 w-3" /> WhatsApp · {whatsappNumber}
                              </span>
                            )
                          )}
                          {vendor.phone && <span>📞 {vendor.phone}</span>}
                          {vendor.email && <span>✉️ {vendor.email}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {catalogs.length === 0 && <span>–</span>}
                        {catalogs.length > 0 && (
                          <ul className="flex flex-col gap-1 text-xs">
                            {catalogs.map((entry, index) => {
                              const key = `${vendor.vendor_id}-catalog-${index}`;
                              const isLink = /^https?:\/\//i.test(entry);
                              return (
                                <li key={key}>
                                  {isLink ? (
                                    <a
                                      href={entry}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-emerald-200 underline-offset-4 hover:underline"
                                    >
                                      {entry}
                                    </a>
                                  ) : (
                                    <span className="text-slate-300">{entry}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">{vendor.payment_terms ?? "–"}</td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {vendor.lead_time_days != null ? `${vendor.lead_time_days} days` : "–"}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {vendor.moq_units != null ? `${vendor.moq_units} units` : "–"}
                      </td>
                      <td className="px-6 py-4 align-top">{renderRating(vendor.rating)}</td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {(vendor.tags ?? []).length === 0 && <span>–</span>}
                        {(vendor.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {vendor.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/80 px-2 py-0.5 text-xs"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-xs text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <span>Added {addedOn}</span>
                          <span className="text-slate-600">Updated {updatedOn}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(vendor)}
                            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(vendor)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="text-sm text-slate-400">{`Showing ${startIndex}-${endIndex} of ${vendors.length}`}</div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setPageSize(nextSize);
                    setPage(1);
                  }}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="text-sm text-slate-200">
                  Page {Math.min(page, totalPages)} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingVendor ? "Edit vendor" : "Add vendor"}
        widthClass="max-w-4xl"
      >
        <VendorForm vendor={editingVendor} onSubmit={handleVendorSubmit} onCancel={closeModal} />
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default VendorsPage;
