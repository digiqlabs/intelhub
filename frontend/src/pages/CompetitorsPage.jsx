import { useState } from "react";
import { ClipboardList, PlusCircle, Users } from "lucide-react";

import CompetitorList from "../components/CompetitorList";
import AddForm from "../components/AddForm";
import Modal from "../components/Modal";
import ToastStack from "../components/ToastStack";
import WishModal from "../components/WishModal";
import useToast from "../hooks/useToast";

function CompetitorsPage({ baseUrl, onDataChanged = () => {} }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [editingCompetitor, setEditingCompetitor] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [wishPrefillCompetitors, setWishPrefillCompetitors] = useState([]);
  const [wishPrefillUrls, setWishPrefillUrls] = useState([]);

  const { toasts, push, dismiss } = useToast();

  const bumpRefresh = () => {
    setRefreshToken((value) => value + 1);
    onDataChanged();
  };

  const handleCreated = () => {
    bumpRefresh();
    setIsFormOpen(false);
    setEditingCompetitor(null);
  };

  const handleUpdated = () => {
    bumpRefresh();
    setEditingCompetitor(null);
    setIsFormOpen(false);
  };

  const handleDeleted = (businessName) => {
    bumpRefresh();
    if (editingCompetitor?.business_name === businessName) {
      setEditingCompetitor(null);
    }
  };

  const openCreateModal = () => {
    setEditingCompetitor(null);
    setIsFormOpen(true);
  };

  const openEditModal = (competitor) => {
    setEditingCompetitor(competitor);
    setIsFormOpen(true);
  };

  const handleDismiss = () => {
    setIsFormOpen(false);
    setEditingCompetitor(null);
  };

  const handleAddWishFromCompetitor = (competitor) => {
    if (!competitor) return;
    const competitorNames = competitor.business_name ? [competitor.business_name] : [];
    const referenceUrls = [
      competitor.instagram_url,
      competitor.facebook_url,
      competitor.website_url,
      competitor.newsletter_url
    ].filter(Boolean);
    setWishPrefillCompetitors(competitorNames);
    setWishPrefillUrls(referenceUrls);
    setWishModalOpen(true);
  };

  const handleWishClose = () => {
    setWishModalOpen(false);
    setWishPrefillCompetitors([]);
    setWishPrefillUrls([]);
  };

  const handleWishSaved = (_, { mode }) => {
    push({
      variant: "success",
      title: mode === "updated" ? "Wish updated" : "Wish captured",
      description: "Pinned to your sourcing queue."
    });
    setWishModalOpen(false);
    setWishPrefillCompetitors([]);
    setWishPrefillUrls([]);
  };

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-10 text-slate-200 shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.45em] text-slate-500">
              <ClipboardList className="h-4 w-4" /> Workspace
            </p>
            <h1 className="text-3xl font-semibold text-slate-100">Competitor workspace</h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Review tracked brands, tune watchlists, and add fresh intel without leaving this board.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-xs font-medium text-slate-300">
              <Users className="h-4 w-4" /> Collaborate with your team in real time.
            </span>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              <PlusCircle className="h-4 w-4" /> Add competitor
            </button>
          </div>
        </div>
      </header>

      <CompetitorList
        baseUrl={baseUrl}
        refreshToken={refreshToken}
        onEdit={openEditModal}
        onDeleted={handleDeleted}
        onAddWish={handleAddWishFromCompetitor}
      />

      <Modal
        open={isFormOpen}
        onClose={handleDismiss}
        title={editingCompetitor ? "Edit competitor" : "New competitor"}
        widthClass="max-w-5xl"
      >
        <AddForm
          key={editingCompetitor?.business_name || "new"}
          baseUrl={baseUrl}
          competitor={editingCompetitor}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onCancelEdit={handleDismiss}
        />
      </Modal>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-300 drop-shadow-panel">
        <h2 className="text-2xl font-semibold text-slate-100">Alerts (coming soon)</h2>
        <p className="mt-3 text-sm">
          Automate Slack, email, or webhook alerts when your competitors hit growth milestones or launch new
          campaigns. Wire it up to your preferred channel once backend jobs are online.
        </p>
      </section>

      <WishModal
        open={wishModalOpen}
        onClose={handleWishClose}
        onSaved={handleWishSaved}
        prefillCompetitors={wishPrefillCompetitors}
        prefillReferenceUrls={wishPrefillUrls}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default CompetitorsPage;
