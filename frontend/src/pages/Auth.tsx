import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Alert, Field } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { api, ApiError, errorMessage } from "../services/api";
import type { User } from "../types";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/konto";
}

function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      <div className="relative hidden bg-navy lg:block">
        <img src="/images/how.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-navy/40" aria-hidden="true" />
        <div className="on-dark relative flex h-full flex-col justify-end p-14 text-white">
          <Logo light />
          <p className="mt-5 font-serif text-4xl leading-tight">Buy better.<br />Sail further.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <h1 className="display text-4xl">{title}</h1>
          {intro && <p className="mt-3 text-steel-600">{intro}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-steel-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { user, setUser } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api.post<{ user: User }>("/api/auth/login", { email, password }),
    onSuccess: (r) => { setUser(r.user); navigate(next, { replace: true }); },
  });
  if (user && !m.isSuccess) return <Navigate to={next} replace />;
  return (
    <AuthShell title="Anmelden" intro={sp.get("next") ? "Bitte melde dich an, um fortzufahren." : "Willkommen zurück."}
      footer={<>Noch kein Konto? <Link className="link" to={`/registrieren${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}>Jetzt registrieren</Link></>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }} noValidate={false}>
        {sp.get("reset") && <Alert kind="success">Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.</Alert>}
        {m.isError && <Alert>{errorMessage(m.error)}</Alert>}
        <Field label="E-Mail-Adresse" required>{(p) => <input {...p} type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Passwort" required>{(p) => <input {...p} type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <button className="btn-primary w-full" disabled={m.isPending}>{m.isPending ? "Anmeldung läuft …" : "Anmelden"}</button>
        <p className="text-sm"><Link className="link" to="/passwort-vergessen">Passwort vergessen?</Link></p>
      </form>
    </AuthShell>
  );
}

const TYPES = [
  { v: "buyer", title: "Ich suche ein Boot", text: "Boote merken und Verkäufer kontaktieren." },
  { v: "private_seller", title: "Ich verkaufe privat", text: "Eigenes Boot inserieren – zusätzlich zu allen Käuferfunktionen." },
  { v: "dealer", title: "Ich bin Händler oder Werft", text: "Händlerprofil, Bestandsverwaltung und Zustandsberichte." },
] as const;

export function Register() {
  const { user, setUser } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(sp.get("next"));
  const initial = sp.get("typ") === "haendler" ? "dealer" : sp.get("typ") === "verkaeufer" ? "private_seller" : "buyer";
  const [f, setF] = useState({ display_name: "", email: "", password: "", account_type: initial as string, company_name: "" });
  const [accepted, setAccepted] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post<{ user: User }>("/api/auth/register", { ...f, company_name: f.account_type === "dealer" ? f.company_name : null }),
    onSuccess: (r) => { setUser(r.user); navigate(f.account_type === "dealer" && !sp.get("next") ? "/haendler" : next, { replace: true }); },
  });
  if (user && !m.isSuccess) return <Navigate to={next} replace />;
  const fields = m.error instanceof ApiError ? m.error.fields ?? {} : {};
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthShell title="Konto erstellen" intro="Kostenlos registrieren. Deine Rolle kannst du später erweitern."
      footer={<>Bereits registriert? <Link className="link" to="/anmelden">Anmelden</Link></>}>
      <form className="space-y-5" onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        {m.isError && <Alert>{errorMessage(m.error)}</Alert>}
        <fieldset>
          <legend className="label">Wie möchtest du REFURBED SAIL nutzen?</legend>
          <div className="space-y-2">
            {TYPES.map((o) => (
              <label key={o.v} className={`flex cursor-pointer gap-3 border px-4 py-3 ${f.account_type === o.v ? "border-navy bg-white" : "border-line bg-white/60 hover:border-navy/40"}`}>
                <input type="radio" name="account_type" className="mt-1 accent-navy" checked={f.account_type === o.v} onChange={() => setF({ ...f, account_type: o.v })} />
                <span><span className="block text-sm font-semibold text-navy">{o.title}</span><span className="block text-[0.82rem] text-steel-600">{o.text}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {f.account_type === "dealer" && (
          <Field label="Firmenname" required hint="Die Verifizierung als Händler erfolgt nach der Registrierung durch unser Team.">{(p) => <input {...p} required maxLength={120} className="input" value={f.company_name} onChange={set("company_name")} autoComplete="organization" />}</Field>
        )}
        <Field label="Anzeigename" required error={fields.display_name} hint="So erscheinst du gegenüber anderen Nutzern.">{(p) => <input {...p} required minLength={2} maxLength={80} className="input" value={f.display_name} onChange={set("display_name")} autoComplete="name" />}</Field>
        <Field label="E-Mail-Adresse" required error={fields.email}>{(p) => <input {...p} type="email" required className="input" value={f.email} onChange={set("email")} autoComplete="email" />}</Field>
        <Field label="Passwort" required error={fields.password} hint="Mindestens 10 Zeichen, nicht nur Buchstaben oder nur Ziffern.">{(p) => <input {...p} type="password" required minLength={10} className="input" value={f.password} onChange={set("password")} autoComplete="new-password" />}</Field>
        <label className="flex gap-3 text-sm text-ink/85">
          <input type="checkbox" required className="mt-1 h-4 w-4 accent-navy" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>Ich akzeptiere die <Link className="link" to="/agb" target="_blank">AGB</Link> und habe die <Link className="link" to="/datenschutz" target="_blank">Datenschutzhinweise</Link> gelesen.</span>
        </label>
        <button className="btn-primary w-full" disabled={m.isPending}>{m.isPending ? "Konto wird erstellt …" : "Konto erstellen"}</button>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const m = useMutation({ mutationFn: () => api.post("/api/auth/password/reset-request", { email }) });
  return (
    <AuthShell title="Passwort vergessen" intro="Gib deine E-Mail-Adresse ein. Falls ein Konto besteht, senden wir dir einen Link zum Zurücksetzen."
      footer={<Link className="link" to="/anmelden">Zurück zur Anmeldung</Link>}>
      {m.isSuccess ? <Alert kind="success">Falls zu dieser Adresse ein Konto besteht, wurde ein Link zum Zurücksetzen versendet. Er ist zwei Stunden gültig.</Alert> : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          {m.isError && <Alert>{errorMessage(m.error)}</Alert>}
          <Field label="E-Mail-Adresse" required>{(p) => <input {...p} type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}</Field>
          <button className="btn-primary w-full" disabled={m.isPending}>Link anfordern</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api.post("/api/auth/password/reset-confirm", { token, password }),
    onSuccess: () => navigate("/anmelden?reset=1", { replace: true }),
  });
  return (
    <AuthShell title="Neues Passwort" footer={<Link className="link" to="/passwort-vergessen">Neuen Link anfordern</Link>}>
      {!token ? <Alert>Der Link ist unvollständig. Bitte fordere einen neuen an.</Alert> : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          {m.isError && <Alert>{errorMessage(m.error)}</Alert>}
          <Field label="Neues Passwort" required hint="Mindestens 10 Zeichen, nicht nur Buchstaben oder nur Ziffern.">{(p) => <input {...p} type="password" required minLength={10} className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}</Field>
          <button className="btn-primary w-full" disabled={m.isPending}>Passwort speichern</button>
        </form>
      )}
    </AuthShell>
  );
}
