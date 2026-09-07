/**
 * SetuGov seal — a circular emblem with an abstract "setu" (bridge) linking two
 * pillars. Deliberately NOT the State Emblem of India; this is a product mark
 * for a prototype, not official insignia.
 */
export function Emblem({ className, title = "SetuGov" }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path d="M13 40c8-13 13-19 19-19s11 6 19 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 40h38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 40v7M32 30v17M46 40v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="21" r="2.6" fill="currentColor" />
    </svg>
  );
}
