import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

function MasterProductForm({ product, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [metal, setMetal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (product) {
      setName(product.name ?? "");
      setDescription(product.description ?? "");
      setProductType(product.product_type ?? "");
      setMetal(product.metal ?? "");
    } else {
      setName("");
      setDescription("");
      setProductType("");
      setMetal("");
    }
    setError(null);
  }, [product]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      product_type: productType.trim() || null,
      metal: metal.trim() || null
    };

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.(payload);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || err.message || "Unable to save master product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error && (
        <p className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Product name *</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Eg. Radiant Moonstone Studs"
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Product type</span>
          <input
            type="text"
            value={productType}
            onChange={(event) => setProductType(event.target.value)}
            placeholder="Earrings, Necklace, Bracelet…"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Metal</span>
          <input
            type="text"
            value={metal}
            onChange={(event) => setMetal(event.target.value)}
            placeholder="925 silver, 18k gold, brass…"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Key design notes, craftsmanship details, or sourcing notes"
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? "Saving…" : product ? "Save changes" : "Save master product"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default MasterProductForm;
