/** A decorative spinner; `spinner` (shared/demo.css) by default, or a demo's own class. */
export function Spinner({ className = "spinner" }: { className?: string }) {
  return <span className={className} aria-hidden />;
}
