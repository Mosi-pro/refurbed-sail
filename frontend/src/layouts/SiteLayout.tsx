import { useQuery } from "@tanstack/react-query";
import { Heart, Instagram, Menu, MessageSquare, User as UserIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { site } from "../config/site";
import { useAuth } from "../hooks/useAuth";
import { t } from "../i18n";
import { api } from "../services/api";
import type { Facets } from "../types";

const NAV = [
  { to: "/boote", label: t.nav.boats },
  { to: "/refurbished", label: t.nav.refurbished },
  { to: "/haendler", label: t.nav.dealers },
  { to: "/so-funktionierts", label: t.nav.how },
];

function useUnread() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["unread"], queryFn: () => api.get<{ unread: number }>("/api/conversations/unread-count"),
    enabled: !!user, refetchInterval: 30_000 });
  return user ? q.data?.unread ?? 0 : 0;
}

function Header() {
  const { user, logout, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const unread = useUnread();
  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-[0.9rem] font-medium transition-colors hover:text-navy ${isActive ? "text-navy after:absolute after:inset-x-0 after:-bottom-[1px] after:h-px after:bg-brass" : "text-ink/80"}`;
  const doLogout = async () => { await logout(); navigate("/"); };
  const accountLinks = [
    { to: "/konto", label: t.nav.account },
    { to: "/konto/nachrichten", label: `${t.nav.messages}${unread ? ` (${unread})` : ""}` },
    ...(hasRole("dealer") ? [{ to: "/haendler", label: t.nav.dealerArea }] : []),
    ...(hasRole("admin") ? [{ to: "/admin", label: t.nav.admin }] : []),
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-navy focus:px-4 focus:py-2 focus:text-white">Zum Inhalt springen</a>
      <div className="container-page flex h-[72px] items-center justify-between gap-6">
        <div className="flex items-center gap-10 xl:gap-14">
          <Link to="/" className="shrink-0"><Logo /></Link>
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-7 lg:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={navCls} end={n.to === "/haendler" ? false : undefined}>{n.label}</NavLink>)}
          </nav>
        </div>
        <div className="hidden items-center gap-5 lg:flex">
          <Link to="/merkliste" className="flex items-center gap-2 text-[0.9rem] font-medium text-ink/80 hover:text-navy"><Heart className="h-4 w-4" aria-hidden="true" />{t.nav.favorites}</Link>
          {user ? (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu"
                className="flex items-center gap-2 text-[0.9rem] font-medium text-ink/80 hover:text-navy">
                <UserIcon className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-[140px] truncate">{user.display_name}</span>
                {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center bg-navy px-1 text-[0.68rem] font-bold text-white" aria-label={`${unread} ungelesene Nachrichten`}>{unread}</span>}
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-full mt-3 w-56 border border-line bg-white py-2 shadow-[0_12px_32px_-12px_rgba(16,36,53,0.25)]">
                  {accountLinks.map((l) => <Link key={l.to} role="menuitem" to={l.to} className="block px-4 py-2 text-sm hover:bg-sand">{l.label}</Link>)}
                  <div className="divider my-2" />
                  <button role="menuitem" onClick={doLogout} className="block w-full px-4 py-2 text-left text-sm hover:bg-sand">{t.nav.logout}</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/anmelden" className="text-[0.9rem] font-medium text-ink/80 hover:text-navy">{t.nav.login}</Link>
          )}
          <Link to="/inserat-erstellen" className="btn-primary">{t.nav.sell}</Link>
        </div>
        <button className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden" onClick={() => setOpen(true)} aria-label={t.nav.menu} aria-expanded={open}>
          <Menu className="h-6 w-6 text-navy" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy text-white on-dark lg:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <div className="container-page flex h-[72px] items-center justify-between">
            <Link to="/"><Logo light /></Link>
            <button className="-mr-2 flex h-11 w-11 items-center justify-center" onClick={() => setOpen(false)} aria-label={t.nav.close}><X className="h-6 w-6" /></button>
          </div>
          <nav aria-label="Mobile Navigation" className="container-page flex-1 overflow-y-auto pb-10 pt-6">
            <ul className="border-t border-white/15">
              {NAV.map((n) => (
                <li key={n.to} className="border-b border-white/15"><Link to={n.to} className="block py-4 font-serif text-3xl">{n.label}</Link></li>
              ))}
            </ul>
            <ul className="mt-8 space-y-1 text-[1.05rem]">
              <li><Link to="/merkliste" className="flex items-center gap-3 py-2.5"><Heart className="h-4 w-4" aria-hidden="true" />{t.nav.favorites}</Link></li>
              {user ? (<>
                {accountLinks.map((l, i) => <li key={l.to}><Link to={l.to} className="flex items-center gap-3 py-2.5">{i === 1 ? <MessageSquare className="h-4 w-4" aria-hidden="true" /> : <UserIcon className="h-4 w-4" aria-hidden="true" />}{l.label}</Link></li>)}
                <li><button onClick={doLogout} className="py-2.5 text-white/70">{t.nav.logout}</button></li>
              </>) : (
                <li><Link to="/anmelden" className="flex items-center gap-3 py-2.5"><UserIcon className="h-4 w-4" aria-hidden="true" />{t.nav.login}</Link></li>
              )}
            </ul>
            <Link to="/inserat-erstellen" className="btn-light mt-8 w-full">{t.nav.sell}</Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function DemoNotice() {
  const { data } = useQuery({ queryKey: ["facets"], queryFn: () => api.get<Facets>("/api/boats/facets"), staleTime: 60_000 });
  if (!data?.has_demo) return null;
  return (
    <div className="border-b border-brass/30 bg-[#F3EDE3] text-center text-[0.8rem] text-ink">
      <p className="container-page py-2"><strong className="font-semibold">Demoversion.</strong> Alle als „Demo-Inserat“ gekennzeichneten Boote, Händler und Dokumente sind fiktiv und stehen nicht zum Verkauf.</p>
    </div>
  );
}

function Footer() {
  const col = "space-y-2.5 text-sm text-white/75";
  const a = "hover:text-white";
  return (
    <footer className="on-dark mt-24 bg-navy text-white">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 font-serif text-2xl leading-snug">Buy better.<br />Sail further.</p>
          <p className="mt-4 max-w-xs text-sm text-white/65">Der Marktplatz für gebrauchte und professionell aufbereitete Segelboote.</p>
        </div>
        <nav aria-label="Marktplatz">
          <h2 className="eyebrow mb-4 !text-white/55">Marktplatz</h2>
          <ul className={col}>
            <li><Link className={a} to="/boote">Boote entdecken</Link></li>
            <li><Link className={a} to="/refurbished">Refurbished</Link></li>
            <li><Link className={a} to="/haendler/verzeichnis">Händlerverzeichnis</Link></li>
            <li><Link className={a} to="/inserat-erstellen">Boot inserieren</Link></li>
          </ul>
        </nav>
        <nav aria-label="Unternehmen">
          <h2 className="eyebrow mb-4 !text-white/55">Unternehmen</h2>
          <ul className={col}>
            <li><Link className={a} to="/ueber-uns">Über uns</Link></li>
            <li><Link className={a} to="/kontakt">Kontakt</Link></li>
            <li><Link className={a} to="/haendler/werden">Händler werden</Link></li>
            <li><Link className={a} to="/hilfe">Hilfe</Link></li>
          </ul>
        </nav>
        <nav aria-label="Rechtliches">
          <h2 className="eyebrow mb-4 !text-white/55">Rechtliches</h2>
          <ul className={col}>
            <li><Link className={a} to="/impressum">Impressum</Link></li>
            <li><Link className={a} to="/datenschutz">Datenschutz</Link></li>
            <li><Link className={a} to="/agb">AGB</Link></li>
            <li><a className={`${a} inline-flex items-center gap-2`} href={site.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram className="h-4 w-4" aria-hidden="true" />Instagram</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/12">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-white/55 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} REFURBED SAIL</p>
          <p>Preise in Euro · Maße in metrischen Einheiten</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const loc = useLocation();
  useEffect(() => { if (!loc.hash) window.scrollTo(0, 0); }, [loc.pathname, loc.hash]);
  return (
    <div className="flex min-h-screen flex-col">
      <DemoNotice />
      <Header />
      <main id="inhalt" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
