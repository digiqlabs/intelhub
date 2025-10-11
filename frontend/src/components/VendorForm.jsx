import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

const normalizeList = (value = "") =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const digitsOnly = (value = "") => value.replace(/\D/g, "");

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const nullIfEmpty = (value) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeWebsite = (value) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed === "https://" || trimmed === "http://") return null;
  return trimmed;
};

function VendorForm({ vendor, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("https://");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [catalogUrlsText, setCatalogUrlsText] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [moqUnits, setMoqUnits] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [rating, setRating] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!vendor) {
      setName("");
      setWebsiteUrl("https://");
      setWhatsappNumber("");
      setEmail("");
      setPhone("");
      setCity("");
      setCountry("");
      setCatalogUrlsText("");
      setLeadTimeDays("");
      setMoqUnits("");
      setPaymentTerms("");
      setRating("");
      setTagsText("");
      setNotes("");
      setError(null);
      return;
    }

    setName(vendor.name ?? "");
  setWebsiteUrl(vendor.website_url ?? "https://");
  setWhatsappNumber(digitsOnly(vendor.whatsapp_link ?? "").slice(-10));
  setEmail(vendor.email ?? "");
  setPhone(digitsOnly(vendor.phone ?? "").slice(-10));
    setCity(vendor.city ?? "");
    setCountry(vendor.country ?? "");
    setCatalogUrlsText((vendor.catalog_urls ?? []).join("\n"));
    setLeadTimeDays(vendor.lead_time_days ?? "");
    setMoqUnits(vendor.moq_units ?? "");
    setPaymentTerms(vendor.payment_terms ?? "");
    setRating(vendor.rating ?? "");
    setTagsText((vendor.tags ?? []).join(", "));
    setNotes(vendor.notes ?? "");
    setError(null);
  }, [vendor]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vendor name is required");
      return;
    }

    const sanitizedPhone = digitsOnly(phone);
    if (sanitizedPhone && sanitizedPhone.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }

    const sanitizedWhatsapp = digitsOnly(whatsappNumber);
    if (sanitizedWhatsapp && sanitizedWhatsapp.length !== 10) {
      setError("WhatsApp number must be exactly 10 digits");
      return;
    }

    const payload = {
      name: trimmedName,
      website_url: normalizeWebsite(websiteUrl),
      whatsapp_link: sanitizedWhatsapp || null,
      email: nullIfEmpty(email),
      phone: sanitizedPhone || null,
      city: nullIfEmpty(city),
      country: nullIfEmpty(country),
      catalog_urls: normalizeList(catalogUrlsText),
      lead_time_days: numberOrNull(leadTimeDays),
      moq_units: numberOrNull(moqUnits),
      payment_terms: nullIfEmpty(paymentTerms),
      rating: numberOrNull(rating),
      tags: normalizeList(tagsText),
      notes: nullIfEmpty(notes)
    };

    if (payload.rating !== null && (payload.rating < 1 || payload.rating > 5)) {
      setError("Rating must be between 1 and 5 stars");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.(payload);
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unable to save vendor";
      setError(Array.isArray(detail) ? detail.join(" ") : detail);
      return;
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Vendor name *</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Jewellery Works"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Website URL</span>
          <input
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://vendor.example.com"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">WhatsApp number</span>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(digitsOnly(event.target.value).slice(0, 10))}
            placeholder="9876543210"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="hello@vendor.com"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Phone</span>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={phone}
            onChange={(event) => setPhone(digitsOnly(event.target.value).slice(0, 10))}
            placeholder="9876543210"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">City</span>
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Jaipur"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Country</span>
            <input
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="India"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Catalog links (optional)</span>
        <input
          type="text"
          value={catalogUrlsText}
          onChange={(event) => setCatalogUrlsText(event.target.value)}
          placeholder="Drive folder, Airtable view, or any notes"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Lead time (days)</span>
          <input
            type="number"
            min="0"
            value={leadTimeDays}
            onChange={(event) => setLeadTimeDays(event.target.value)}
            placeholder="12"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">MOQ (units)</span>
          <input
            type="number"
            min="0"
            value={moqUnits}
            onChange={(event) => setMoqUnits(event.target.value)}
            placeholder="50"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Rating</span>
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} star{value > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Payment terms</span>
        <input
          type="text"
          value={paymentTerms}
          onChange={(event) => setPaymentTerms(event.target.value)}
          placeholder="50% advance, 50% on dispatch"
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Tags</span>
        <input
          type="text"
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="silver, jadau, artisan"
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
        <span className="text-xs text-slate-500">Use commas or new lines to separate tags.</span>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Quality notes, negotiation leverage, or sample feedback"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? "Saving…" : vendor ? "Save vendor" : "Create vendor"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default VendorForm;
