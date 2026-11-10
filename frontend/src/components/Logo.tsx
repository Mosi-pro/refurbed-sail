/** Typographic wordmark: letter-spaced sans for REFURBED, serif for SAIL, joined by a brass rule. */
export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const color = light ? "text-white" : "text-navy";
  return (
    <span className={`inline-flex items-center whitespace-nowrap ${color} ${className}`} aria-label="REFURBED SAIL">
      <span aria-hidden="true" className="text-[0.82rem] font-bold tracking-[0.3em]">REFURBED</span>
      <span aria-hidden="true" className="mx-2.5 h-4 w-px bg-brass" />
      <span aria-hidden="true" className="font-serif text-[1.3rem] leading-none tracking-[0.14em]">SAIL</span>
    </span>
  );
}
