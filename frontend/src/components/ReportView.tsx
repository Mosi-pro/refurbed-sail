import { FileText, Image as ImageIcon, ShieldCheck, UserRound } from "lucide-react";
import { label } from "../i18n";
import { formatBytes, formatDate } from "../lib/format";
import type { DocumentOut, Report } from "../types";
import { EntryStatusBadge } from "./badges";

export function DocumentLink({ doc }: { doc: DocumentOut }) {
  const Icon = doc.kind === "pdf" ? FileText : ImageIcon;
  return (
    <a href={doc.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-2 border border-line bg-sand px-3 py-2 text-[0.82rem] font-medium text-navy hover:border-navy">
      <Icon className="h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" />
      <span className="truncate">{doc.title}</span>
      <span className="shrink-0 text-xs text-steel-600">{doc.kind === "pdf" ? "PDF" : "Foto"} · {formatBytes(doc.size_bytes)}</span>
    </a>
  );
}

/** Read-only condition report. Always states where the information comes from. */
export function ReportView({ report, sellerName }: { report: Report; sellerName: string }) {
  const independent = report.verification === "independently_verified";
  return (
    <div>
      <div className={`flex gap-4 border-l-2 px-5 py-4 ${independent ? "border-brass bg-[#F6F1E8]" : "border-navy/30 bg-sand"}`}>
        {independent ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" /> : <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-steel-600" aria-hidden="true" />}
        <div className="text-sm">
          {independent ? (<>
            <p className="font-semibold text-navy">Unabhängig geprüfte Angaben</p>
            <p className="mt-1 text-ink/80">Dieser Bericht wurde von {report.verified_by} geprüft und von REFURBED SAIL am {formatDate(report.verified_at)} bestätigt.</p>
          </>) : (<>
            <p className="font-semibold text-navy">Angaben des Verkäufers</p>
            <p className="mt-1 text-ink/80">Dieser Bericht wurde von {sellerName} erstellt. Die Angaben wurden nicht unabhängig geprüft. Lass dir Belege zeigen und besichtige das Boot vor dem Kauf.</p>
          </>)}
        </div>
      </div>
      {report.summary && <p className="mt-6 max-w-3xl whitespace-pre-line text-ink/90">{report.summary}</p>}
      <ol className="mt-8 border-t border-navy/15">
        {report.entries.map((e) => (
          <li key={e.id} className="grid gap-3 border-b border-line py-6 md:grid-cols-[200px_1fr] md:gap-8">
            <div>
              <h3 className="text-[1.05rem] font-semibold">{label("section", e.section)}</h3>
              <div className="mt-2"><EntryStatusBadge status={e.status} /></div>
              {e.work_date && <p className="mt-2 text-xs text-steel-600">Arbeiten am {formatDate(e.work_date)}</p>}
            </div>
            <div className="min-w-0">
              {e.description ? <p className="whitespace-pre-line text-[0.95rem] text-ink/90">{e.description}</p> : <p className="text-sm text-steel-600">Keine Beschreibung hinterlegt.</p>}
              {e.seller_notes && (
                <p className="mt-3 border-l border-brass pl-3 text-sm text-steel-600"><span className="font-semibold text-navy">Anmerkung des Verkäufers: </span>{e.seller_notes}</p>
              )}
              {e.documents.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{e.documents.map((d) => <DocumentLink key={d.id} doc={d} />)}</div>}
            </div>
          </li>
        ))}
      </ol>
      {report.seller_notes && (
        <div className="mt-6 text-sm"><h3 className="font-semibold text-navy">Hinweise des Verkäufers</h3><p className="mt-1 whitespace-pre-line text-steel-600">{report.seller_notes}</p></div>
      )}
    </div>
  );
}
