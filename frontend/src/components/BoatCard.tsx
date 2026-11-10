import { Heart, ImageOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { label } from "../i18n";
import { boatLocation, boatTitle, formatMeters, formatPrice } from "../lib/format";
import type { BoatCard as Boat } from "../types";
import { ConditionTag, DemoTag, RefurbTag, SellerTypeLabel } from "./badges";

export function FavoriteButton({ boatId, className = "", withLabel = false }: { boatId: number; className?: string; withLabel?: boolean }) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const navigate = useNavigate();
  const loc = useLocation();
  const active = isFavorite(boatId);
  const text = active ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen";
  return (
    <button type="button" aria-pressed={active} aria-label={withLabel ? undefined : text} title={withLabel ? undefined : text}
      onClick={(e) => {
        e.preventDefault();
        if (!user) navigate(`/anmelden?next=${encodeURIComponent(loc.pathname + loc.search)}`);
        else toggle(boatId);
      }}
      className={className || "flex h-10 w-10 items-center justify-center bg-white/95 text-navy hover:bg-white"}>
      <Heart className={`h-[18px] w-[18px] ${active ? "fill-navy" : ""}`} aria-hidden="true" />
      {withLabel && <span>{active ? "Gemerkt" : "Merken"}</span>}
    </button>
  );
}

export function BoatImageFrame({ boat, className = "aspect-[4/3]" }: { boat: Pick<Boat, "image">; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-line ${className}`}>
      {boat.image ? (
        <img src={boat.image.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-steel"><ImageOff className="h-6 w-6" aria-hidden="true" /></div>
      )}
    </div>
  );
}

export function BoatCard({ boat }: { boat: Boat }) {
  return (
    <article className="group relative flex flex-col border border-line bg-white transition-colors hover:border-navy/30">
      <div className="relative">
        <BoatImageFrame boat={boat} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <ConditionTag boat={boat} />
          {boat.is_demo && <DemoTag />}
        </div>
        <div className="absolute right-3 top-3 z-10"><FavoriteButton boatId={boat.id} /></div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">{label("category", boat.category)}</p>
          <SellerTypeLabel type={boat.seller_type} />
        </div>
        <h3 className="mt-1.5 text-[1.15rem] font-semibold leading-snug text-navy">
          <Link to={`/boote/${boat.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-navy">
            {boatTitle(boat)}
          </Link>
        </h3>
        <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-steel-600">
          <div><dt className="sr-only">Baujahr</dt><dd>{boat.year ?? "–"}</dd></div>
          <span aria-hidden="true" className="text-line">|</span>
          <div><dt className="sr-only">Länge</dt><dd>{formatMeters(boat.length_m)}</dd></div>
          <span aria-hidden="true" className="text-line">|</span>
          <div><dt className="sr-only">Standort</dt><dd>{boatLocation(boat) || "–"}</dd></div>
        </dl>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-5">
          <p className="text-xl font-semibold tracking-tight text-navy">
            {formatPrice(boat.price_eur)}
            {boat.price_negotiable && <span className="ml-1.5 text-xs font-medium text-steel-600">VB</span>}
          </p>
          <RefurbTag boat={boat} />
        </div>
      </div>
    </article>
  );
}

export function BoatGrid({ boats, cols = 3 }: { boats: Boat[]; cols?: 3 | 4 }) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 ${cols === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {boats.map((b) => <BoatCard key={b.id} boat={b} />)}
    </div>
  );
}

export function BoatCardSkeleton() {
  return (
    <div className="border border-line bg-white" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-line" />
      <div className="space-y-3 px-5 py-5">
        <div className="h-3 w-1/4 animate-pulse bg-line" /><div className="h-5 w-2/3 animate-pulse bg-line" />
        <div className="h-3 w-1/2 animate-pulse bg-line" /><div className="h-6 w-1/3 animate-pulse bg-line" />
      </div>
    </div>
  );
}
