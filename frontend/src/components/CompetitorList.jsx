import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertCircle, FileDown, Loader2, Pin, RefreshCw, Search, Sparkles, Users } from "lucide-react";

const formatNumber = (value) => {
  if (value === null || value === undefined) return "–";
  if (Number.isNaN(Number(value))) return value;
  return new Intl.NumberFormat().format(Number(value));
};

const normalize = (value = "") => value.toLowerCase().trim();

const toCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function CompetitorList({
  baseUrl,
  refreshToken,
  onEdit = () => {},
  onDeleted = () => {},
  onAddWish = () => {}
}) {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const client = useMemo(
    () =>
      axios.create({
        baseURL: baseUrl,
        timeout: 8000
      }),
    [baseUrl]
  );

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get("/competitors");
      const payload = Array.isArray(data) ? data : data?.results ?? [];
      setCompetitors(payload);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors, refreshToken]);

  const uniqueTags = useMemo(() => {
    const tagSet = new Set();
    competitors.forEach((competitor) => {
      (competitor.tags ?? []).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [competitors]);

  useEffect(() => {
    setSelectedTags((prev) => prev.filter((tag) => uniqueTags.includes(tag)));
  }, [uniqueTags]);

  const filteredCompetitors = useMemo(() => {
    const term = normalize(searchTerm);
    const activeTags = new Set(selectedTags);

    return competitors.filter((competitor) => {
      const tags = competitor.tags ?? [];
      if (activeTags.size > 0) {
        const hasAllTags = Array.from(activeTags).every((tag) => tags.includes(tag));
        if (!hasAllTags) return false;
      }

      if (!term) return true;

      const haystack = [
        competitor.business_name,
        competitor.instagram_handle,
        competitor.instagram_url,
        competitor.facebook_url,
        competitor.website_url,
        competitor.country,
        competitor.city,
        competitor.price_range,
        competitor.primary_platform,
        competitor.priority,
        competitor.whatsapp_link,
        competitor.newsletter_url,
        String(competitor.domain_authority ?? ""),
        String(competitor.intel_score ?? ""),
        ...(competitor.tags ?? []),
        ...(competitor.categories ?? [])
      ]
        .filter(Boolean)
        .map((value) => normalize(String(value)));

      return haystack.some((value) => value.includes(term));
    });
  }, [competitors, searchTerm, selectedTags]);

  const errorMessage = useMemo(() => {
    if (!error) return "";
    return error.response?.data?.detail || error.message || "Unexpected error";
  }, [error]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag];
      setPage(1);
      return next;
    });
  };

  const handleExportCsv = () => {
    if (filteredCompetitors.length === 0) return;

    const header = [
      "Business Name",
      "Instagram Handle",
      "Instagram URL",
      "Instagram Followers",
      "Facebook URL",
      "Facebook Followers",
      "Website URL",
      "Country",
      "City",
      "Categories",
      "Primary Platform",
      "Price Range",
      "WhatsApp Link",
      "Newsletter URL",
      "Domain Authority",
      "Intel Score",
      "Priority",
      "Watchlist",
      "Tags"
    ];

    const rows = filteredCompetitors.map((competitor) => [
      competitor.business_name,
      competitor.instagram_handle,
      competitor.instagram_url,
      competitor.instagram_followers,
      competitor.facebook_url,
      competitor.facebook_followers,
      competitor.website_url,
      competitor.country,
      competitor.city,
      (competitor.categories ?? []).join(";"),
      competitor.primary_platform,
      competitor.price_range,
      competitor.whatsapp_link,
      competitor.newsletter_url,
      competitor.domain_authority,
      competitor.intel_score,
      competitor.priority,
      competitor.watchlist ? "Yes" : "No",
      (competitor.tags ?? []).join(";")
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => toCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "intelhub-competitors.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEdit = (competitor) => {
    onEdit?.(competitor);
  };

  const handleWish = (competitor) => {
    onAddWish?.(competitor);
  };

  const handleDelete = useCallback(
    async (competitor) => {
      const { business_name: businessName } = competitor;
      if (!businessName) return;
      const confirmed = window.confirm(`Remove ${businessName}? This cannot be undone.`);
      if (!confirmed) return;

      setDeletingId(businessName);
      setError(null);
      try {
        await client.delete(`/competitors/${encodeURIComponent(businessName)}`);
        onDeleted?.(businessName);
        await fetchCompetitors();
      } catch (err) {
        setError(err);
      } finally {
        setDeletingId(null);
      }
    },
    [client, fetchCompetitors, onDeleted]
  );

  const totalPages = Math.max(1, Math.ceil(filteredCompetitors.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCompetitors = filteredCompetitors.slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedTags, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value));
  };

  const goToPreviousPage = () => {
    setPage((value) => Math.max(1, value - 1));
  };

  const goToNextPage = () => {
    setPage((value) => Math.min(totalPages, value + 1));
  };

  return (
    <section
      id="competitors"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 drop-shadow-panel"
    >
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Users className="h-6 w-6" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Competitors</h2>
            <span className="text-xs text-slate-500">
              {filteredCompetitors.length} shown · {competitors.length} total
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fetchCompetitors}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredCompetitors.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search competitors, handles, tags…"
              className="w-full rounded-full border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>

        {uniqueTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Filter tags</span>
            {uniqueTags.map((tag) => {
              const isActive = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </header>

      {loading && (
        <div className="mt-10 flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>Loading competitors…</span>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Unable to load competitors</p>
              <p className="mt-1 text-rose-200/80">{errorMessage}</p>
              <button
                type="button"
                onClick={fetchCompetitors}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && filteredCompetitors.length === 0 && (
        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center text-slate-400">
          <p>No competitors match the current filters.</p>
          {competitors.length === 0 && (
            <p className="mt-2 text-sm">Use the form below to add your first tracked brand.</p>
          )}
        </div>
      )}

      {!loading && !error && filteredCompetitors.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <p>
              Showing {paginatedCompetitors.length} of {filteredCompetitors.length} filtered competitors
            </p>
            <label className="inline-flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-950/40">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.35em] text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Business
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Social
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-slate-300">
                    Scores
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
                {paginatedCompetitors.map((competitor) => {
                  const location = [competitor.city, competitor.country].filter(Boolean).join(", ");
                  const socialLines = [
                    competitor.instagram_followers != null
                      ? `IG · ${formatNumber(competitor.instagram_followers)}`
                      : null,
                    competitor.facebook_followers != null
                      ? `FB · ${formatNumber(competitor.facebook_followers)}`
                      : null,
                  ].filter(Boolean);
                  const scoreLines = [
                    competitor.intel_score != null ? `Intel ${formatNumber(competitor.intel_score)}` : null,
                    competitor.domain_authority != null
                      ? `DA ${formatNumber(competitor.domain_authority)}`
                      : null,
                    competitor.priority ? competitor.priority.toUpperCase() : null,
                  ].filter(Boolean);
                  const tagContent = [...(competitor.tags ?? []), ...(competitor.categories ?? [])]
                    .slice(0, 4)
                    .join(" · ");

                  return (
                    <tr key={competitor.business_name} className="hover:bg-slate-900/60">
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-100">
                            {competitor.business_name}
                            {competitor.watchlist && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-200">
                                <Pin className="h-3 w-3" /> Watchlist
                              </span>
                            )}
                          </p>
                          {competitor.instagram_handle && (
                            <p className="text-xs text-slate-400">{competitor.instagram_handle}</p>
                          )}
                          {competitor.website_url && (
                            <a
                              href={competitor.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-emerald-200 underline-offset-4 hover:underline"
                            >
                              Visit site
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">{location || "–"}</td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {socialLines.length > 0 ? socialLines.map((line) => <p key={line}>{line}</p>) : "–"}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {scoreLines.length > 0 ? scoreLines.map((line) => <p key={line}>{line}</p>) : "–"}
                        {competitor.whatsapp_link && (
                          <a
                            href={competitor.whatsapp_link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-emerald-200 underline-offset-4 hover:underline"
                          >
                            WhatsApp
                          </a>
                        )}
                        {competitor.newsletter_url && (
                          <a
                            href={competitor.newsletter_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 inline-block text-xs text-emerald-200 underline-offset-4 hover:underline"
                          >
                            Newsletter
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">
                        {tagContent || "–"}
                        {((competitor.tags ?? []).length + (competitor.categories ?? []).length) > 4 && (
                          <p className="text-xs text-slate-500">+ more</p>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleWish(competitor)}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden="true" /> Wish
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(competitor)}
                            className="rounded-full border border-slate-700/80 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(competitor)}
                            disabled={deletingId === competitor.business_name}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-500/50 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {deletingId === competitor.business_name ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              "🗑️ Delete"
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <p>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-700/80 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="rounded-full border border-slate-700/80 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CompetitorList;
