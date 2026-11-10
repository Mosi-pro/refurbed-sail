import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Role } from "../types";
import { LoadingState } from "./ui";

/** Client-side route guard. Authorisation is always enforced again by the API. */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading, hasRole } = useAuth();
  const loc = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to={`/anmelden?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (role && !hasRole(role))
    return (
      <div className="container-page py-24 text-center">
        <p className="eyebrow">Kein Zugriff</p>
        <h1 className="display mt-3 text-4xl">Dieser Bereich ist nicht für dein Konto freigeschaltet.</h1>
        <Link className="btn-primary mt-8" to="/konto">Zu meinem Konto</Link>
      </div>
    );
  return <>{children}</>;
}
