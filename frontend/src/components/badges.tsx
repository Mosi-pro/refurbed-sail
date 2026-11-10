import { BadgeCheck, FileCheck2 } from "lucide-react";
import { label, t } from "../i18n";
import type { BoatCard, BoatStatus, DealerVerification, EntryStatus, SellerType } from "../types";

export function ConditionTag({ boat }: { boat: Pick<BoatCard, "condition"> }) {
  const strong = boat.condition !== "used";
  return <span className={`tag ${strong ? "border-navy bg-navy text-white" : "border-navy/20 bg-white text-navy"}`}>{label("condition", boat.condition)}</span>;
}

export function RefurbTag({ boat }: { boat: Pick<BoatCard, "refurb_status"> }) {
  if (boat.refurb_status === "none") return null;
  return <span className="tag whitespace-nowrap border-brass/60 bg-white text-brass-700"><FileCheck2 className="h-3 w-3" aria-hidden="true" />{label("refurbStatus", boat.refurb_status)}</span>;
}

export function DemoTag() {
  return <span className="tag border-navy/20 bg-sand text-steel-600" title="Fiktives Beispielinserat – kein reales Angebot">{t.common.demo}</span>;
}

export function SellerTypeLabel({ type }: { type: SellerType }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.78rem] font-semibold text-steel-600">
      {type === "verified_dealer" && <BadgeCheck className="h-3.5 w-3.5 text-brass-700" aria-hidden="true" />}
      {label("sellerType", type)}
    </span>
  );
}

export function StatusBadge({ status }: { status: BoatStatus }) {
  const style: Record<BoatStatus, string> = {
    active: "border-ok/40 text-ok", pending: "border-brass/60 text-brass-700", draft: "border-navy/20 text-steel-600",
    paused: "border-navy/20 text-navy", rejected: "border-danger/40 text-danger", archived: "border-navy/20 text-steel-600",
    removed: "border-danger/40 text-danger",
  };
  return <span className={`tag bg-white ${style[status]}`}>{label("boatStatus", status)}</span>;
}

export function VerificationBadge({ status }: { status: DealerVerification }) {
  const verified = status === "verified" || status === "refurb_documented";
  return (
    <span className={`tag ${verified ? "border-brass/60 text-brass-700" : "border-navy/20 text-steel-600"} bg-white`}>
      {verified && <BadgeCheck className="h-3 w-3" aria-hidden="true" />}
      {label("dealerVerification", status)}
    </span>
  );
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const style: Record<EntryStatus, string> = {
    inspected: "border-navy/30 text-navy", renewed: "border-ok/40 text-ok", repaired: "border-ok/40 text-ok",
    not_inspected: "border-navy/20 text-steel-600", defect_reported: "border-danger/40 text-danger",
  };
  return <span className={`tag bg-white ${style[status]}`}>{label("entryStatus", status)}</span>;
}
