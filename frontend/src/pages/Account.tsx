import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BoatGrid } from "../components/BoatCard";
import { ListingsTable } from "../components/ListingsTable";
import { Messages } from "../components/Messages";
import { Alert, Avatar, EmptyState, ErrorState, Field, LoadingState } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { label } from "../i18n";
import { formatMonthYear } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatCard, User } from "../types";

export function AccountLayout() {
  const { user, isSeller, hasRole } = useAuth();
  const tabs = [
    { to: "/konto", label: "Übersicht", end: true },
    ...(isSeller ? [{ to: "/konto/inserate", label: "Meine Inserate" }] : []),
    { to: "/konto/nachrichten", label: "Nachrichten" },
    { to: "/konto/merkliste", label: "Merkliste" },
    { to: "/konto/profil", label: "Profil" },
    { to: "/konto/einstellungen", label: "Einstellungen" },
  ];
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="container-page pt-10">
          <p className="eyebrow">Mein Konto</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="display text-4xl">{user!.display_name}</h1>
            <div className="flex gap-2">
              {hasRole("dealer") && <Link to="/haendler" className="btn-secondary btn-sm">Händlerbereich</Link>}
              {hasRole("admin") && <Link to="/admin" className="btn-secondary btn-sm">Administration</Link>}
            </div>
          </div>
          <nav aria-label="Kontobereiche" className="-mb-px mt-8 flex gap-7 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end}
                className={({ isActive }) => `whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${isActive ? "border-navy text-navy" : "border-transparent text-steel-600 hover:text-navy"}`}>{tab.label}</NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="container-page py-10"><Outlet /></div>
    </>
  );
}

interface Overview { listings: Record<string, number>; listings_total: number; unread_messages: number; favorites: number; conversations: number }

export function AccountOverview() {
  const { user, isSeller } = useAuth();
  const q = useQuery({ queryKey: ["account-overview"], queryFn: () => api.get<Overview>("/api/account/overview") });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const rows: [string, string | number, string, string][] = [
    ["Ungelesene Nachrichten", o.unread_messages, "/konto/nachrichten", `${o.conversations} Unterhaltungen insgesamt`],
    ["Gemerkte Boote", o.favorites, "/konto/merkliste", "Deine Merkliste"],
    ...(isSeller ? [["Aktive Inserate", o.listings.active ?? 0, "/konto/inserate", `${o.listings.draft ?? 0} Entwürfe · ${o.listings.pending ?? 0} in Prüfung`] as [string, number, string, string]] : []),
  ];
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
      <div>
        <dl className="grid border-l border-t border-line sm:grid-cols-3">
          {rows.map(([k, v, to, sub]) => (
            <div key={k} className="relative border-b border-r border-line bg-white p-6 hover:bg-sand">
              <dt className="eyebrow"><Link to={to} className="after:absolute after:inset-0">{k}</Link></dt>
              <dd className="mt-3 font-serif text-4xl text-navy">{v}</dd>
              <dd className="mt-1 text-xs text-steel-600">{sub}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 border border-line bg-white p-7">
          {isSeller ? (<>
            <h2 className="text-lg font-semibold">Ein weiteres Boot anbieten</h2>
            <p className="mt-1 text-sm text-steel-600">Lege ein Inserat an – Entwürfe werden gespeichert und können jederzeit fortgesetzt werden.</p>
            <Link to="/inserat-erstellen" className="btn-primary mt-5">Boot inserieren</Link>
          </>) : (<>
            <h2 className="text-lg font-semibold">Du möchtest ein Boot verkaufen?</h2>
            <p className="mt-1 text-sm text-steel-600">Aktiviere die Verkäuferfunktionen für dein Konto – kostenlos und in einem Schritt.</p>
            <Link to="/inserat-erstellen" className="btn-primary mt-5">Boot inserieren</Link>
          </>)}
        </div>
      </div>
      <aside className="border border-line bg-white p-7 lg:self-start">
        <div className="flex items-center gap-4"><Avatar src={user!.avatar_url} name={user!.display_name} size={56} />
          <div className="min-w-0"><p className="truncate font-semibold text-navy">{user!.display_name}</p><p className="truncate text-sm text-steel-600">{user!.email}</p></div></div>
        <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-steel-600">Rollen</dt><dd className="text-right font-medium">{user!.roles.map((r) => label("role", r)).join(", ")}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-steel-600">Mitglied seit</dt><dd className="font-medium">{formatMonthYear(user!.created_at)}</dd></div>
        </dl>
        <Link to="/konto/profil" className="link mt-5 inline-block text-sm">Profil bearbeiten</Link>
      </aside>
    </div>
  );
}

export function AccountListings() {
  const q = useQuery({ queryKey: ["my-boats"], queryFn: () => api.get<{ items: BoatCard[] }>("/api/my/boats") });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Meine Inserate <span className="text-base font-normal text-steel-600">({q.data!.items.length})</span></h2>
        <Link to="/inserat-erstellen" className="btn-primary">Neues Inserat</Link>
      </div>
      {q.data!.items.length === 0 ? <EmptyState title="Noch kein Inserat" text="Lege dein erstes Inserat an. Du kannst es als Entwurf speichern und später veröffentlichen." action={<Link to="/inserat-erstellen" className="btn-primary">Boot inserieren</Link>} />
        : <ListingsTable boats={q.data!.items} />}
    </div>
  );
}

export function AccountMessages() { return <Messages basePath="/konto/nachrichten" />; }

export function AccountFavorites() {
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => api.get<{ items: BoatCard[] }>("/api/favorites") });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data!.items.length === 0) return <EmptyState title="Deine Merkliste ist leer" text="Merke dir Boote mit dem Herz-Symbol, um sie später wiederzufinden und zu vergleichen." action={<Link to="/boote" className="btn-primary">Boote entdecken</Link>} />;
  return (<div><h2 className="mb-6 text-xl font-semibold">Merkliste <span className="text-base font-normal text-steel-600">({q.data!.items.length})</span></h2><BoatGrid boats={q.data!.items} cols={4} /></div>);
}

export function AccountProfile() {
  const { user, setUser, hasRole } = useAuth();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ display_name: user!.display_name, location: user!.location ?? "", phone: user!.phone ?? "", bio: user!.bio ?? "" });
  const [company, setCompany] = useState("");
  const save = useMutation({ mutationFn: () => api.put<{ user: User }>("/api/account/profile", f), onSuccess: (r) => setUser(r.user) });
  const avatar = useMutation({ mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api.upload<{ user: User }>("/api/account/avatar", fd); }, onSuccess: (r) => setUser(r.user) });
  const role = useMutation({ mutationFn: (body: { role: string; company_name?: string }) => api.post<{ user: User }>("/api/account/roles", body), onSuccess: (r) => setUser(r.user) });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
      <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <h2 className="text-xl font-semibold">Profil</h2>
        <div className="flex items-center gap-5">
          <Avatar src={user!.avatar_url} name={user!.display_name} size={84} />
          <div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])} />
            <label htmlFor="avatar-file" className="btn-secondary btn-sm cursor-pointer">{avatar.isPending ? "Wird hochgeladen …" : "Profilbild ändern"}</label>
            <p className="mt-1.5 text-xs text-steel-600">JPEG, PNG oder WebP, max. 10 MB</p>
          </div>
        </div>
        {avatar.isError && <Alert>{errorMessage(avatar.error)}</Alert>}
        <Field label="Anzeigename" required>{(p) => <input {...p} required minLength={2} maxLength={80} className="input" value={f.display_name} onChange={set("display_name")} />}</Field>
        <Field label="Wohnort" hint="Wird in deinen Inseraten als Verkäuferstandort angezeigt.">{(p) => <input {...p} maxLength={120} className="input" value={f.location} onChange={set("location")} />}</Field>
        <Field label="Telefon" hint="Nicht öffentlich sichtbar.">{(p) => <input {...p} type="tel" maxLength={40} className="input" value={f.phone} onChange={set("phone")} />}</Field>
        <Field label="Über mich">{(p) => <textarea {...p} rows={4} maxLength={2000} className="input" value={f.bio} onChange={set("bio")} />}</Field>
        <Field label="E-Mail-Adresse" hint="Die E-Mail-Adresse wird anderen Nutzern nie angezeigt.">{(p) => <input {...p} disabled className="input" value={user!.email} />}</Field>
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        {save.isSuccess && <Alert kind="success">Dein Profil wurde gespeichert.</Alert>}
        <button className="btn-primary" disabled={save.isPending}>Profil speichern</button>
      </form>
      <aside className="space-y-5 lg:self-start">
        <div className="border border-line bg-white p-6">
          <h2 className="eyebrow">Deine Rollen</h2>
          <ul className="mt-3 space-y-1 text-sm">{user!.roles.map((r) => <li key={r} className="font-medium">{label("role", r)}</li>)}</ul>
          {role.isError && <div className="mt-4"><Alert>{errorMessage(role.error)}</Alert></div>}
          {!hasRole("private_seller") && !hasRole("dealer") && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-sm text-steel-600">Du möchtest dein eigenes Boot verkaufen?</p>
              <button className="btn-secondary btn-sm mt-3" disabled={role.isPending} onClick={() => role.mutate({ role: "private_seller" })}>Als privater Verkäufer aktivieren</button>
            </div>
          )}
          {!hasRole("dealer") && (
            <form className="mt-5 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); role.mutate({ role: "dealer", company_name: company }); }}>
              <p className="text-sm text-steel-600">Händler oder Werft? Aktiviere den Händlerbereich. Die Verifizierung erfolgt anschließend durch unser Team.</p>
              <div className="mt-3"><Field label="Firmenname" required>{(p) => <input {...p} required minLength={2} maxLength={120} className="input" value={company} onChange={(e) => setCompany(e.target.value)} />}</Field></div>
              <button className="btn-secondary btn-sm mt-3" disabled={role.isPending}>Händlerkonto aktivieren</button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

export function AccountSettings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const pw = useMutation({ mutationFn: () => api.post("/api/auth/password/change", f), onSuccess: () => setF({ current_password: "", new_password: "" }) });
  const all = useMutation({ mutationFn: () => api.post("/api/auth/logout-all"), onSuccess: async () => { await logout().catch(() => undefined); navigate("/anmelden"); } });
  return (
    <div className="max-w-xl space-y-12">
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); pw.mutate(); }}>
        <h2 className="text-xl font-semibold">Passwort ändern</h2>
        <Field label="Aktuelles Passwort" required>{(p) => <input {...p} type="password" required autoComplete="current-password" className="input" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />}</Field>
        <Field label="Neues Passwort" required hint="Mindestens 10 Zeichen, nicht nur Buchstaben oder nur Ziffern.">{(p) => <input {...p} type="password" required minLength={10} autoComplete="new-password" className="input" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} />}</Field>
        {pw.isError && <Alert>{errorMessage(pw.error)}</Alert>}
        {pw.isSuccess && <Alert kind="success">Dein Passwort wurde geändert. Andere Geräte wurden abgemeldet.</Alert>}
        <button className="btn-primary" disabled={pw.isPending}>Passwort ändern</button>
      </form>
      <section className="border-t border-line pt-8">
        <h2 className="text-xl font-semibold">Sitzungen</h2>
        <p className="mt-2 text-sm text-steel-600">Melde dein Konto auf allen Geräten ab, zum Beispiel wenn du ein Gerät verloren hast.</p>
        {all.isError && <div className="mt-3"><Alert>{errorMessage(all.error)}</Alert></div>}
        <button className="btn-secondary mt-4" disabled={all.isPending} onClick={() => all.mutate()}>Überall abmelden</button>
      </section>
    </div>
  );
}
