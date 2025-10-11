import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";

import {
  listTags,
  resolveTag as resolveTagApi
} from "../lib/api";

const CATEGORY_STYLES = {
  material: "ring-emerald-400/70 text-emerald-100",
  motif: "ring-amber-400/70 text-amber-100",
  style: "ring-sky-400/70 text-sky-100",
  occasion: "ring-rose-400/70 text-rose-100",
  color: "ring-purple-400/70 text-purple-100",
  technique: "ring-fuchsia-400/70 text-fuchsia-100",
  region: "ring-indigo-400/70 text-indigo-100",
  trend: "ring-lime-400/70 text-lime-100",
  "price-band": "ring-yellow-400/70 text-yellow-100",
  other: "ring-slate-500/70 text-slate-200"
};

const STATUS_BADGE = {
  active: "bg-emerald-500/20 text-emerald-200",
  draft: "bg-slate-700/60 text-slate-200",
  deprecated: "bg-rose-500/20 text-rose-200"
};

function normalizeQuery(value) {
  return value.trim().toLowerCase();
}

function TagPicker({
  value = [],
  onChange,
  placeholder = "Search tags…",
  entityType,
  disabled = false,
  hideStatusBadges = false
}) {
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function hydrate() {
      if (!value || value.length === 0) {
        setSelected([]);
        return;
      }
      setLoadingSelected(true);
      try {
        const data = await listTags({
          slugs: value.join(","),
          entity_type: entityType || undefined
        });
        if (ignore) return;
        const mapped = new Map(data.map((tag) => [tag.tag_slug, tag]));
        setSelected(
          value
            .map((slug) => {
              const tag = mapped.get(slug);
              if (!tag) return null;
              return {
                ...tag,
                resolvedFrom: null,
                justCreated: false
              };
            })
            .filter(Boolean)
        );
      } catch (err) {
        console.error("Unable to load tags", err);
      } finally {
        if (!ignore) setLoadingSelected(false);
      }
    }

    hydrate();
    return () => {
      ignore = true;
    };
  }, [value, entityType]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setError(null);
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    async function search() {
      setLoadingSuggestions(true);
      setError(null);
      try {
        const data = await listTags({
          query,
          status: "active",
          entity_type: entityType || undefined
        });
        if (ignore) return;
        const selectedSlugs = new Set(selected.map((tag) => tag.tag_slug));
        setSuggestions(data.filter((tag) => !selectedSlugs.has(tag.tag_slug)));
      } catch (err) {
        if (!ignore) {
          console.error("Tag search failed", err);
          setError("Unable to fetch tags");
        }
      } finally {
        if (!ignore) setLoadingSuggestions(false);
      }
    }

    const timeout = setTimeout(search, 180);
    return () => {
      ignore = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected, entityType]);

  const emitChange = (next) => {
    setSelected(next);
    onChange?.(next.map((tag) => tag.tag_slug));
  };

  const handleRemove = (slug) => {
    const next = selected.filter((tag) => tag.tag_slug !== slug);
    emitChange(next);
  };

  const handleResolve = async (inputValue) => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (selected.some((tag) => tag.tag_slug === trimmed)) {
      setQuery("");
      return;
    }

    setResolving(true);
    setError(null);
    try {
      const response = await resolveTagApi(trimmed);
      const { tag, created } = response;
      if (selected.some((entry) => entry.tag_slug === tag.tag_slug)) {
        setQuery("");
        return;
      }
      const normalizedInput = normalizeQuery(trimmed);
      const resolvedFrom =
        !created && normalizedInput && normalizeQuery(tag.display_name) !== normalizedInput
          ? trimmed
          : null;
      emitChange([
        ...selected,
        {
          ...tag,
          resolvedFrom,
          justCreated: created
        }
      ]);
      setQuery("");
      setShowDropdown(false);
      setSuggestions([]);
    } catch (err) {
      console.error("Unable to resolve tag", err);
      setError(err?.response?.data?.detail || err?.message || "Unable to resolve tag");
    } finally {
      setResolving(false);
    }
  };

  const handleSuggestionClick = (tag) => {
    emitChange([
      ...selected,
      {
        ...tag,
        resolvedFrom: null,
        justCreated: false
      }
    ]);
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (suggestions.length > 0 && showDropdown) {
        handleSuggestionClick(suggestions[0]);
      } else {
        handleResolve(query);
      }
    } else if (event.key === "Backspace" && !query && selected.length > 0) {
      event.preventDefault();
      handleRemove(selected[selected.length - 1].tag_slug);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const helperText = useMemo(() => {
    if (resolving) return "Creating tag…";
    if (error) return error;
    if (!query && selected.length === 0) {
      return "Press enter to create a new tag or pick from suggestions";
    }
    return null;
  }, [resolving, error, query, selected.length]);

  return (
    <div className={`rounded-3xl border border-slate-700/70 bg-slate-950/70 p-4 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => {
          const categoryStyle = CATEGORY_STYLES[tag.category] || CATEGORY_STYLES.other;
          return (
            <span
              key={tag.tag_slug}
              className={`group inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-medium ring-2 ring-offset-0 ${categoryStyle}`}
              title={tag.resolvedFrom ? `Resolved from alias “${tag.resolvedFrom}”` : tag.justCreated ? "Draft tag created" : undefined}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>{tag.display_name}</span>
              {!hideStatusBadges && (
                <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] ${STATUS_BADGE[tag.status] ?? STATUS_BADGE.draft}`}>
                  {tag.status}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(tag.tag_slug)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-transparent text-slate-200 transition hover:border-slate-500 hover:text-white"
                aria-label={`Remove ${tag.display_name}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative mt-3" ref={dropdownRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-full border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed"
        />
        {(loadingSuggestions || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/95 shadow-lg shadow-slate-950/40">
            <ul className="divide-y divide-slate-800/70">
              {suggestions.map((tag) => (
                <li key={tag.tag_slug}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(tag)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-900/70"
                  >
                    <div>
                      <p className="font-medium text-slate-200">{tag.display_name}</p>
                      <p className="text-xs text-slate-500">{tag.tag_slug}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] ${STATUS_BADGE[tag.status] ?? STATUS_BADGE.draft}`}>
                      {tag.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <Plus className="h-3 w-3" />
        <span>{helperText || "Type a tag name and press enter to capture it."}</span>
      </div>

      {loadingSelected && (
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Syncing tags…
        </div>
      )}
    </div>
  );
}

export default TagPicker;
