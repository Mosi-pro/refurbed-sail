import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { label } from "../i18n";
import { formatDateTime, formatPrice } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { Conversation } from "../types";
import { Alert, Avatar, EmptyState, ErrorState, LoadingState } from "./ui";

/** Conversation list + thread. Uses polling (list 15 s, open thread 5 s). */
export function Messages({ basePath, role }: { basePath: string; role?: "seller" }) {
  const { id } = useParams();
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => api.get<{ items: Conversation[] }>("/api/conversations"), refetchInterval: 15_000 });
  if (list.isLoading) return <LoadingState />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data!.items.filter((c) => !role || c.role === role);
  if (items.length === 0 && !id)
    return <EmptyState title={role ? "Noch keine Anfragen" : "Noch keine Nachrichten"}
      text={role ? "Sobald Interessenten dich zu einem Inserat kontaktieren, erscheinen die Anfragen hier." : "Wenn du einen Verkäufer kontaktierst oder eine Anfrage erhältst, findest du die Unterhaltung hier."}
      action={<Link className="btn-primary" to="/boote">Boote entdecken</Link>} />;
  return (
    <div className="grid border border-line bg-white lg:min-h-[620px] lg:grid-cols-[340px_1fr]">
      <ul className={`divide-y divide-line border-line lg:block lg:border-r ${id ? "hidden" : ""}`} aria-label="Unterhaltungen">
        {items.map((c) => (
          <li key={c.id}>
            <Link to={`${basePath}/${c.id}`} aria-current={String(c.id) === id ? "page" : undefined}
              className={`flex gap-3 px-4 py-4 hover:bg-sand ${String(c.id) === id ? "bg-sand" : ""}`}>
              {c.boat.thumb_url ? <img src={c.boat.thumb_url} alt="" className="h-14 w-[72px] shrink-0 object-cover" /> : <span className="h-14 w-[72px] shrink-0 bg-line" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${c.unread ? "font-bold text-navy" : "font-semibold text-navy"}`}>{c.other.name}</span>
                  {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center bg-navy px-1 text-[0.68rem] font-bold text-white" aria-label={`${c.unread} ungelesen`}>{c.unread}</span>}
                </span>
                <span className="block truncate text-xs text-steel-600">{c.boat.title} · {c.boat.reference}</span>
                <span className={`mt-0.5 block truncate text-[0.82rem] ${c.unread ? "text-ink" : "text-steel-600"}`}>{c.last_message?.mine ? "Du: " : ""}{c.last_message?.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {id ? <Thread key={id} id={id} basePath={basePath} /> : (
        <div className="hidden items-center justify-center p-10 text-sm text-steel-600 lg:flex">Wähle eine Unterhaltung aus.</div>
      )}
    </div>
  );
}

function Thread({ id, basePath }: { id: string; basePath: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ["conversation", id], queryFn: () => api.get<Conversation>(`/api/conversations/${id}`), refetchInterval: 5_000, retry: false });
  const count = q.data?.messages?.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); qc.invalidateQueries({ queryKey: ["unread"] }); qc.invalidateQueries({ queryKey: ["conversations"] }); }, [count, qc]);
  const send = useMutation({
    mutationFn: () => api.post(`/api/conversations/${id}/messages`, { body: body.trim() }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["conversation", id] }); },
  });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <div className="p-8"><ErrorState error={q.error} /></div>;
  const c = q.data!;
  return (
    <section className="flex min-h-[520px] flex-col" aria-label={`Unterhaltung mit ${c.other.name}`}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to={basePath} className="p-2 lg:hidden" aria-label="Zurück zur Übersicht"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar src={c.other.image_url} name={c.other.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">{c.other.name}</p>
          <p className="truncate text-xs text-steel-600">
            {c.boat.status === "active" ? <Link className="underline decoration-brass underline-offset-2" to={`/boote/${c.boat.slug}`}>{c.boat.title}</Link> : `${c.boat.title} (nicht mehr online)`}
            {" · "}{c.boat.reference} · {formatPrice(c.boat.price_eur)}
          </p>
        </div>
      </header>
      <ol className="flex-1 space-y-4 overflow-y-auto bg-sand/60 px-4 py-5 lg:max-h-[480px]" aria-live="polite">
        {c.messages!.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-3 text-[0.92rem] sm:max-w-[70%] ${m.mine ? "bg-navy text-white" : "border border-line bg-white text-ink"}`}>
              {m.kind !== "message" && <p className={`mb-1.5 text-[0.68rem] font-semibold uppercase tracking-label ${m.mine ? "text-white/70" : "text-brass-700"}`}>{label("messageKind", m.kind)}</p>}
              <p className="whitespace-pre-line break-words">{m.body}</p>
              <p className={`mt-1.5 text-[0.7rem] ${m.mine ? "text-white/65" : "text-steel-600"}`}>
                <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>{m.mine && (m.read_at ? " · Gelesen" : " · Gesendet")}
              </p>
            </div>
          </li>
        ))}
        <div ref={end} />
      </ol>
      <form className="border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}>
        {send.isError && <div className="mb-2"><Alert>{errorMessage(send.error)}</Alert></div>}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="msg-input">Nachricht</label>
          <textarea id="msg-input" className="input max-h-40 min-h-[44px] flex-1 resize-y" rows={2} maxLength={4000} placeholder="Nachricht schreiben …" value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate(); }} />
          <button className="btn-primary" disabled={send.isPending || !body.trim()}><Send className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Senden</span><span className="sr-only sm:hidden">Senden</span></button>
        </div>
      </form>
    </section>
  );
}
