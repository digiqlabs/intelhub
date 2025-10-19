import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";

import Modal from "../components/Modal";
import MasterProductForm from "../components/MasterProductForm";
import ToastStack from "../components/ToastStack";
import useToast from "../hooks/useToast";
import {
  createMasterProduct,
  deleteMasterProduct,
  listMasterProducts,
  updateMasterProduct
} from "../lib/api";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const normalize = (value = "") => value.toLowerCase().trim();

function MasterProductsPage({ onDataChanged }) {
  const [masterProducts, setMasterProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { toasts, push, dismiss } = useToast();

  const fetchMasterProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMasterProducts();
      const sorted = [...(data || [])].sort((a, b) => {
        const updatedA = a?.updated_at || a?.created_at;
        const updatedB = b?.updated_at || b?.created_at;
        const timeA = updatedA ? new Date(updatedA).getTime() : 0;
        const timeB = updatedB ? new Date(updatedB).getTime() : 0;
        return timeB - timeA;
      });
      setMasterProducts(sorted);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to load master products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterProducts();
  }, [fetchMasterProducts, refreshToken]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const filteredProducts = useMemo(() => {
    const term = normalize(query);
    if (!term) return masterProducts;
    return masterProducts.filter((product) => {
      const haystack = [product.name, product.product_type, product.metal, product.description]
        .filter(Boolean)
        .map((value) => normalize(String(value)));
      return haystack.some((value) => value.includes(term));
    });
  }, [masterProducts, query]);

  const pageCount = useMemo(() => {
    if (!filteredProducts.length) return 0;
    return Math.ceil(filteredProducts.length / pageSize);
  }, [filteredProducts.length, pageSize]);

  const resolvedPage = useMemo(() => {
    if (!pageCount) return 1;
    return Math.min(Math.max(1, currentPage), pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (currentPage !== resolvedPage) {
      setCurrentPage(resolvedPage);
    }
  }, [currentPage, resolvedPage]);

  const paginatedProducts = useMemo(() => {
    if (!filteredProducts.length) return [];
    const start = (resolvedPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, resolvedPage, pageSize]);

  const startIndex = useMemo(() => {
    if (!filteredProducts.length) return 0;
    return (resolvedPage - 1) * pageSize + 1;
  }, [filteredProducts.length, resolvedPage, pageSize]);

  const endIndex = useMemo(() => {
    if (!filteredProducts.length) return 0;
    return Math.min(filteredProducts.length, resolvedPage * pageSize);
  }, [filteredProducts.length, resolvedPage, pageSize]);

  const pageNumbers = useMemo(() => {
    if (!pageCount) return [];
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const start = Math.max(1, resolvedPage - 2);
    const end = Math.min(pageCount, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [resolvedPage, pageCount]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const bumpRefresh = () => {
    setRefreshToken((value) => value + 1);
  };

  const handleSubmit = async (payload) => {
    try {
      if (editingProduct) {
        await updateMasterProduct(editingProduct.product_id, payload);
        push({ variant: "success", title: "Master product updated" });
      } else {
        await createMasterProduct(payload);
        push({ variant: "success", title: "Master product added" });
      }
      closeModal();
      bumpRefresh();
      onDataChanged?.();
    } catch (err) {
      push({
        variant: "error",
        title: "Save failed",
        description: err.response?.data?.detail || err.message || "Unable to save master product"
      });
      throw err;
    }
  };

  const handleDelete = async (product) => {
    const confirmDelete = window.confirm(
      `Remove \"${product.name}\"? Wishes linked to this product will lose the association.`
    );
    if (!confirmDelete) return;

    setDeletingId(product.product_id);
    try {
      await deleteMasterProduct(product.product_id);
      push({ variant: "success", title: "Master product deleted" });
      bumpRefresh();
      onDataChanged?.();
    } catch (err) {
      push({
        variant: "error",
        title: "Delete failed",
        description: err.response?.data?.detail || err.message || "Unable to delete master product"
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-10 shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-6 text-slate-200">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.45em] text-slate-500">
              <Box className="h-4 w-4" /> Master catalog
            </p>
            <h1 className="text-3xl font-semibold text-white">Master product library</h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Document every hero piece once and reuse it everywhere — your wishlist, vendor briefs, and launch plans stay
              perfectly in sync.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <PlusCircle className="h-4 w-4" /> Add master product
          </button>
        </div>

        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, type, metal, or notes"
            className="w-full rounded-full border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading master products…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-10 text-rose-100">
          <p className="text-base font-semibold">Unable to load master products</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          <button
            type="button"
            onClick={fetchMasterProducts}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
          >
            Refresh
          </button>
        </div>
      )}

      {!loading && !error && filteredProducts.length === 0 && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/50 p-12 text-center text-slate-400">
          <p>{query ? "No master products match your search." : "Add your first canonical product to get started."}</p>
        </div>
      )}

      {!loading && !error && paginatedProducts.length > 0 && (
        <div className="overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-950/40">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.35em] text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                  Product
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                  Metal
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-right font-semibold text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedProducts.map((product) => {
                const isDeleting = deletingId === product.product_id;
                const createdLabel = product.created_at
                  ? new Date(product.created_at).toLocaleDateString()
                  : "—";
                const updatedLabel = product.updated_at
                  ? new Date(product.updated_at).toLocaleDateString()
                  : createdLabel;
                return (
                  <tr key={product.product_id} className="hover:bg-slate-900/60">
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-100">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          Added on {createdLabel} · Updated {updatedLabel}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-slate-300">{product.product_type ?? "–"}</td>
                    <td className="px-6 py-4 align-top text-slate-300">{product.metal ?? "–"}</td>
                    <td className="px-6 py-4 align-top text-slate-300">
                      {product.description ? (
                        <p>{product.description}</p>
                      ) : (
                        <span className="text-slate-500">–</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="rounded-full border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-500/60 px-4 py-2 font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
      )}

      {!loading && !error && filteredProducts.length > 0 && (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/50 p-6 text-sm text-slate-300">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-slate-400">
              Showing
              <span className="font-semibold text-slate-100"> {startIndex}</span>
              –
              <span className="font-semibold text-slate-100"> {endIndex}</span>
              of
              <span className="font-semibold text-slate-100"> {filteredProducts.length}</span> master products
            </p>
            <label className="inline-flex items-center gap-2 text-slate-400">
              <span className="text-xs uppercase tracking-[0.3em]">Rows per page</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm font-medium text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {pageCount > 1 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                  disabled={resolvedPage === 1}
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
                  disabled={resolvedPage === pageCount}
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {pageNumbers.map((pageNumber) => {
                  const isActive = pageNumber === resolvedPage;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        isActive
                          ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                          : "border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProduct ? "Edit master product" : "Add master product"}
        widthClass="max-w-3xl"
      >
        <MasterProductForm product={editingProduct} onSubmit={handleSubmit} onCancel={closeModal} />
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default MasterProductsPage;
