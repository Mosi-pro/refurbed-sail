import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { boatTitle, formatDate, formatPrice } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatCard } from "../types";
import { BoatImageFrame } from "./BoatCard";
import { StatusBadge } from "./badges";
import { Alert, Modal } from "./ui";

/** Seller view of own listings with all lifecycle actions. */
export function ListingsTable({ boats }: { boats: BoatCard[] }) {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<BoatCard | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ["my-boats"] }); qc.invalidateQueries({ queryKey: ["dealer-dashboard"] }); qc.invalidateQueries({ queryKey: ["account-overview"] }); qc.invalidateQueries({ queryKey: ["boats"] }); qc.invalidateQueries({ queryKey: ["facets"] }); };
  const status = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => api.post<BoatCard>(`/api/my/boats/${id}/status`, { action }),
    onSuccess: (b, v) => { done(); setNotice(v.action === "publish" && b.status === "pending" ? "Das Inserat wurde eingereicht und wird vor der Veröffentlichung geprüft." : null); },
  });
  const del = useMutation({ mutationFn: (id: number) => api.del(`/api/my/boats/${id}`), onSuccess: () => { done(); setToDelete(null); } });
  const act = (b: BoatCard, action: string, text: string) => (
    <button key={action} className="btn-secondary btn-sm" disabled={status.isPending} onClick={() => status.mutate({ id: b.id, action })}>{text}</button>
  );
  return (
    <div>
      {status.isError && <div className="mb-4"><Alert>{errorMessage(status.error)}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}
      <ul className="border-t border-line">
        {boats.map((b) => (
          <li key={b.id} className="grid gap-4 border-b border-line py-5 sm:grid-cols-[150px_1fr] lg:grid-cols-[150px_1fr_auto]">
            <BoatImageFrame boat={b} className="aspect-[4/3] w-full sm:w-[150px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /><span className="font-mono text-xs text-steel-600">{b.reference}</span></div>
              <h3 className="mt-2 text-lg font-semibold">
                {b.status === "active" ? <Link className="hover:underline" to={`/boote/${b.slug}`}>{boatTitle(b)}</Link> : boatTitle(b)}
                {b.year ? <span className="ml-2 text-sm font-normal text-steel-600">{b.year}</span> : null}
              </h3>
              <p className="mt-0.5 text-sm text-steel-600">{formatPrice(b.price_eur)} · geändert am {formatDate(b.updated_at)}</p>
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-steel-600">
                <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{b.view_count ?? 0} Aufrufe</span>
                <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{b.favorites ?? 0} gemerkt</span>
                <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{b.inquiries ?? 0} Anfragen</span>
              </p>
              {b.status === "rejected" && b.rejection_reason && <p className="mt-3 border-l-2 border-danger/50 pl-3 text-sm text-danger">Abgelehnt: {b.rejection_reason}</p>}
              {b.status === "pending" && <p className="mt-3 text-sm text-brass-700">Wird von unserem Team geprüft.</p>}
            </div>
            <div className="flex flex-wrap content-start items-start gap-2 sm:col-start-2 lg:col-start-3 lg:max-w-[260px] lg:justify-end">
              <Link className="btn-secondary btn-sm" to={`/inserat-erstellen/${b.id}`}>Bearbeiten</Link>
              {b.status !== "active" && <Link className="btn-secondary btn-sm" to={`/boote/${b.slug}`}>Vorschau</Link>}
              {(b.status === "draft" || b.status === "rejected") && act(b, "publish", "Veröffentlichen")}
              {b.status === "active" && act(b, "pause", "Pausieren")}
              {b.status === "paused" && act(b, "resume", "Fortsetzen")}
              {b.status === "pending" && act(b, "to_draft", "Zurückziehen")}
              {b.status === "archived" && act(b, "to_draft", "Als Entwurf wiederherstellen")}
              {["active", "paused", "draft", "rejected"].includes(b.status) && act(b, "archive", "Archivieren")}
              <button className="btn-danger btn-sm" onClick={() => setToDelete(b)}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
      {toDelete && (
        <Modal title="Inserat löschen" onClose={() => setToDelete(null)}>
          <p className="text-sm">Möchtest du „{boatTitle(toDelete)}“ ({toDelete.reference}) endgültig löschen? Fotos, Dokumente und zugehörige Unterhaltungen werden entfernt. Das lässt sich nicht rückgängig machen.</p>
          {del.isError && <div className="mt-4"><Alert>{errorMessage(del.error)}</Alert></div>}
          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setToDelete(null)}>Abbrechen</button>
            <button className="btn-danger" disabled={del.isPending} onClick={() => del.mutate(toDelete.id)}>Endgültig löschen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
