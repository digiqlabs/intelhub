import { useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Factory, Home as HomeIcon, Layers3, Sparkles, Users } from "lucide-react";

import Home from "./components/Home";
import useSummary from "./hooks/useSummary";
import CompetitorsPage from "./pages/CompetitorsPage";
import MasterProductsPage from "./pages/MasterProductsPage";
import WishListPage from "./pages/WishList";
import VendorsPage from "./pages/VendorsPage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8002";

function App() {
  const today = useMemo(() => new Date().toLocaleDateString(), []);
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  const { summary } = useSummary(API_BASE_URL, summaryRefresh);

  const handleDataChanged = () => {
    setSummaryRefresh((value) => value + 1);
  };

  const linkBaseClasses =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

  return (
    <BrowserRouter>
      <main className="min-h-screen bg-slate-950 text-slate-100 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-10 sm:py-16">
          <nav
            aria-label="Primary"
            className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-800/80 bg-slate-950/40 px-6 py-3 text-sm text-slate-200 shadow-inner shadow-slate-950/50 dark:border-slate-800 dark:bg-slate-950/30"
          >
            <span className="text-[0.65rem] uppercase tracking-[0.45em] text-slate-500">
              IntelHub · {today}
            </span>

            <div className="flex flex-wrap items-center gap-3">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `${linkBaseClasses} ${
                    isActive
                      ? "border border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                      : "border border-transparent text-slate-200 hover:border-slate-600 hover:text-white"
                  }`
                }
              >
                <HomeIcon className="h-4 w-4" /> Home
              </NavLink>
              <NavLink
                to="/competitors"
                className={({ isActive }) =>
                  `${linkBaseClasses} ${
                    isActive
                      ? "border border-emerald-400/70 bg-emerald-500 text-emerald-950"
                      : "border border-transparent bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
                  }`
                }
              >
                <Users className="h-4 w-4" /> Competitors
              </NavLink>
              <NavLink
                to="/wishlist"
                className={({ isActive }) =>
                  `${linkBaseClasses} ${
                    isActive
                      ? "border border-emerald-400/70 bg-emerald-500 text-emerald-950"
                      : "border border-transparent bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
                  }`
                }
              >
                <Sparkles className="h-4 w-4" /> Wish list
              </NavLink>
              <NavLink
                to="/master-products"
                className={({ isActive }) =>
                  `${linkBaseClasses} ${
                    isActive
                      ? "border border-emerald-400/70 bg-emerald-500 text-emerald-950"
                      : "border border-transparent bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
                  }`
                }
              >
                <Layers3 className="h-4 w-4" /> Master products
              </NavLink>
              <NavLink
                to="/vendors"
                className={({ isActive }) =>
                  `${linkBaseClasses} ${
                    isActive
                      ? "border border-emerald-400/70 bg-emerald-500 text-emerald-950"
                      : "border border-transparent bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
                  }`
                }
              >
                <Factory className="h-4 w-4" /> Vendors
              </NavLink>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<Home summary={summary} />} />
            <Route
              path="/competitors"
              element={<CompetitorsPage baseUrl={API_BASE_URL} onDataChanged={handleDataChanged} />}
            />
            <Route path="/wishlist" element={<WishListPage />} />
            <Route path="/master-products" element={<MasterProductsPage onDataChanged={handleDataChanged} />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="*" element={<Home summary={summary} />} />
          </Routes>
        </div>
      </main>
    </BrowserRouter>
  );
}

export default App;
