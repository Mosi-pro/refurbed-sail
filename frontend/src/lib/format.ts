import { intlLocale, t } from "../i18n";
import type { BoatCard } from "../types";

const eur = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = (digits: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatPrice = (v: number | null | undefined) => (v ? eur.format(v) : t.common.priceOnRequest);
export const formatMeters = (v: number | null | undefined) => (v != null ? `${num(2).format(v)} m` : "–");
export const formatNumber = (v: number | null | undefined, digits = 0) => (v != null ? num(digits).format(v) : "–");
export const formatDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "–";
export const formatMonthYear = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(new Date(iso)) : "–";
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  const today = new Date();
  const time = new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" }).format(d);
  if (d.toDateString() === today.toDateString()) return `Heute, ${time}`;
  return `${formatDate(iso)}, ${time}`;
}
export const formatBytes = (b: number) => (b > 1048576 ? `${num(1).format(b / 1048576)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const boatTitle = (b: Pick<BoatCard, "manufacturer" | "model">) =>
  [b.manufacturer, b.model].filter(Boolean).join(" ") || "Unbenannter Entwurf";
export const boatLocation = (b: Pick<BoatCard, "location_city" | "location_region">) =>
  [b.location_city, b.location_region && b.location_region !== b.location_city ? b.location_region : null].filter(Boolean).join(", ");
