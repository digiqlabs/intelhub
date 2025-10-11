import { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircle2, Loader2, PlusCircle, RotateCcw } from "lucide-react";

function normalizeList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function AddForm({ baseUrl, competitor = null, onCreated, onUpdated, onCancelEdit }) {
  const [name, setName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [facebookFollowers, setFacebookFollowers] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [categories, setCategories] = useState("");
  const [primaryPlatform, setPrimaryPlatform] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [newsletterUrl, setNewsletterUrl] = useState("");
  const [domainAuthority, setDomainAuthority] = useState("");
  const [intelScore, setIntelScore] = useState("");
  const [priority, setPriority] = useState("");
  const [watchlist, setWatchlist] = useState(false);
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const isEditMode = Boolean(competitor);

  const resetForm = () => {
    setName("");
    setInstagramHandle("");
    setInstagramUrl("");
    setInstagramFollowers("");
    setFacebookUrl("");
    setFacebookFollowers("");
    setWebsiteUrl("");
    setCountry("");
    setCity("");
    setCategories("");
    setPrimaryPlatform("");
    setPriceRange("");
    setWhatsappLink("");
    setNewsletterUrl("");
    setDomainAuthority("");
    setIntelScore("");
    setPriority("");
    setWatchlist(false);
    setTags("");
    setError(null);
    setSuccessMessage("");
  };

  useEffect(() => {
    if (competitor) {
      setName(competitor.business_name ?? "");
      setInstagramHandle(competitor.instagram_handle ?? "");
      setInstagramUrl(competitor.instagram_url ?? "");
      setInstagramFollowers(
        competitor.instagram_followers !== null && competitor.instagram_followers !== undefined
          ? String(competitor.instagram_followers)
          : ""
      );
      setFacebookUrl(competitor.facebook_url ?? "");
      setFacebookFollowers(
        competitor.facebook_followers !== null && competitor.facebook_followers !== undefined
          ? String(competitor.facebook_followers)
          : ""
      );
      setWebsiteUrl(competitor.website_url ?? "");
      setCountry(competitor.country ?? "");
      setCity(competitor.city ?? "");
      setCategories((competitor.categories ?? []).join(", "));
      setPrimaryPlatform(competitor.primary_platform ?? "");
      setPriceRange(competitor.price_range ?? "");
      setWhatsappLink(competitor.whatsapp_link ?? "");
      setNewsletterUrl(competitor.newsletter_url ?? "");
      setDomainAuthority(
        competitor.domain_authority !== null && competitor.domain_authority !== undefined
          ? String(competitor.domain_authority)
          : ""
      );
      setIntelScore(
        competitor.intel_score !== null && competitor.intel_score !== undefined
          ? String(competitor.intel_score)
          : ""
      );
      setPriority(competitor.priority ?? "");
      setWatchlist(Boolean(competitor.watchlist));
      setTags((competitor.tags ?? []).join(", "));
      setError(null);
      setSuccessMessage("");
    } else {
      resetForm();
    }
  }, [competitor]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage("");

    const client = axios.create({ baseURL: baseUrl, timeout: 8000 });

    const payload = {
      business_name: name.trim(),
      instagram_handle: instagramHandle.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      instagram_followers:
        instagramFollowers === "" || Number.isNaN(Number(instagramFollowers))
          ? null
          : Number(instagramFollowers),
      facebook_url: facebookUrl.trim() || null,
      facebook_followers:
        facebookFollowers === "" || Number.isNaN(Number(facebookFollowers))
          ? null
          : Number(facebookFollowers),
      website_url: websiteUrl.trim() || null,
      country: country.trim() || null,
      city: city.trim() || null,
      categories: normalizeList(categories),
      primary_platform: primaryPlatform || null,
      price_range: priceRange.trim() || null,
      whatsapp_link: whatsappLink.trim() || null,
      newsletter_url: newsletterUrl.trim() || null,
      domain_authority:
        domainAuthority === "" || Number.isNaN(Number(domainAuthority))
          ? null
          : Number(domainAuthority),
      intel_score:
        intelScore === "" || Number.isNaN(Number(intelScore))
          ? null
          : Number(intelScore),
      priority: priority || null,
      watchlist,
      tags: normalizeList(tags)
    };

    if (!payload.business_name) {
      setError("Business name is required.");
      setSubmitting(false);
      return;
    }

    try {
      if (isEditMode && competitor) {
        await client.put(`/competitors/${encodeURIComponent(competitor.business_name)}`, payload);
        setSuccessMessage("Competitor updated successfully.");
        onUpdated?.(payload);
      } else {
        await client.post("/competitors", payload);
        setSuccessMessage("Competitor added successfully.");
        resetForm();
        onCreated?.(payload);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = detail
        ? Array.isArray(detail)
          ? detail.join(" ")
          : detail
        : err.message || "Unexpected error";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancelEdit?.();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8">
      <header className="space-y-2 text-slate-200">
        <div className="flex items-center gap-3">
          <PlusCircle className="h-6 w-6" aria-hidden="true" />
          <h2 className="text-xl font-semibold">
            {isEditMode ? `Edit competitor` : `Add competitor`}
          </h2>
        </div>
        {isEditMode && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
            Edit mode
          </span>
        )}
      </header>

      <div className="grid gap-10">
        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">
              Core profile
            </h3>
            <p className="text-sm text-slate-400">Focus on the essentials your teammates need first.</p>
          </div>

          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-200">
              Business name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={isEditMode}
              placeholder="Acme Corp"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="instagram" className="text-sm font-medium text-slate-200">
                Instagram handle
              </label>
              <input
                id="instagram"
                type="text"
                value={instagramHandle}
                onChange={(event) => setInstagramHandle(event.target.value)}
                placeholder="@acme"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="instagramUrl" className="text-sm font-medium text-slate-200">
                Instagram URL
              </label>
              <input
                id="instagramUrl"
                type="url"
                value={instagramUrl}
                onChange={(event) => setInstagramUrl(event.target.value)}
                placeholder="https://instagram.com/acme"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="websiteUrl" className="text-sm font-medium text-slate-200">
              Website URL
            </label>
            <input
              id="websiteUrl"
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://acme.com"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label htmlFor="country" className="text-sm font-medium text-slate-200">
                Country
              </label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="USA"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="city" className="text-sm font-medium text-slate-200">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="New York"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="primaryPlatform" className="text-sm font-medium text-slate-200">
                Primary platform
              </label>
              <select
                id="primaryPlatform"
                value={primaryPlatform}
                onChange={(event) => setPrimaryPlatform(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">Select platform</option>
                <option value="shopify">Shopify</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="amazon">Amazon</option>
                <option value="etsy">Etsy</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="categories" className="text-sm font-medium text-slate-200">
                Categories
              </label>
              <input
                id="categories"
                type="text"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
                placeholder="beauty, skincare"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <p className="text-xs text-slate-500">Comma separated list. Example: athleisure, d2c</p>
            </div>
            <div className="grid gap-2">
              <label htmlFor="tags" className="text-sm font-medium text-slate-200">
                Tags
              </label>
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="growth, enterprise, ecommerce"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <p className="text-xs text-slate-500">Separate tags with commas. Example: fintech, saas, europe</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/40 p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
              Additional signals
            </h3>
            <p className="text-sm text-slate-500">Log supporting metrics and channels to enrich the profile.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="instagramFollowers" className="text-sm font-medium text-slate-200">
                Instagram followers
              </label>
              <input
                id="instagramFollowers"
                type="number"
                min="0"
                value={instagramFollowers}
                onChange={(event) => setInstagramFollowers(event.target.value)}
                placeholder="25000"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="facebookFollowers" className="text-sm font-medium text-slate-200">
                Facebook followers
              </label>
              <input
                id="facebookFollowers"
                type="number"
                min="0"
                value={facebookFollowers}
                onChange={(event) => setFacebookFollowers(event.target.value)}
                placeholder="18000"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="facebookUrl" className="text-sm font-medium text-slate-200">
                Facebook URL
              </label>
              <input
                id="facebookUrl"
                type="url"
                value={facebookUrl}
                onChange={(event) => setFacebookUrl(event.target.value)}
                placeholder="https://facebook.com/acme"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="priceRange" className="text-sm font-medium text-slate-200">
                Price range
              </label>
              <input
                id="priceRange"
                type="text"
                value={priceRange}
                onChange={(event) => setPriceRange(event.target.value)}
                placeholder="$$"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="whatsappLink" className="text-sm font-medium text-slate-200">
                WhatsApp link
              </label>
              <input
                id="whatsappLink"
                type="url"
                value={whatsappLink}
                onChange={(event) => setWhatsappLink(event.target.value)}
                placeholder="https://wa.me/123456789"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="newsletterUrl" className="text-sm font-medium text-slate-200">
                Newsletter URL
              </label>
              <input
                id="newsletterUrl"
                type="url"
                value={newsletterUrl}
                onChange={(event) => setNewsletterUrl(event.target.value)}
                placeholder="https://acme.com/newsletter"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label htmlFor="domainAuthority" className="text-sm font-medium text-slate-200">
                Domain authority
              </label>
              <input
                id="domainAuthority"
                type="number"
                min="0"
                max="100"
                value={domainAuthority}
                onChange={(event) => setDomainAuthority(event.target.value)}
                placeholder="45"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="intelScore" className="text-sm font-medium text-slate-200">
                Intel score
              </label>
              <input
                id="intelScore"
                type="number"
                min="0"
                max="100"
                value={intelScore}
                onChange={(event) => setIntelScore(event.target.value)}
                placeholder="72"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="priority" className="text-sm font-medium text-slate-200">
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={watchlist}
              onChange={(event) => setWatchlist(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-400 focus:ring-emerald-400/60"
            />
            <span>
              Add to watchlist
              <span className="block text-xs text-slate-400">Pin this brand for quick follow-ups.</span>
            </span>
          </label>
        </section>

        {error && (
          <p className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        {successMessage && !error && (
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {successMessage}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {submitting ? "Saving…" : isEditMode ? "Save changes" : "Add competitor"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" /> Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default AddForm;
