type Props = {
  className?: string;
};

// document + magnifying glass mark, not tied to the "DocQuery" wordmark specifically —
// the page/lines render in currentColor (accent-fg) and the "text lines" punch through in
// the badge's own accent color, so it stays legible on the solid accent square in either theme
export default function Logo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="2.5" width="12" height="14.5" rx="2" fill="currentColor" />
      <rect x="5.5" y="6.3" width="6.5" height="1.7" rx="0.85" fill="var(--accent)" />
      <rect x="5.5" y="9.8" width="7.5" height="1.7" rx="0.85" fill="var(--accent)" />
      <rect x="5.5" y="13.3" width="4.5" height="1.7" rx="0.85" fill="var(--accent)" />
      <circle cx="17" cy="17" r="4.2" stroke="currentColor" strokeWidth="2.1" />
      <line x1="20.1" y1="20.1" x2="22.3" y2="22.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}
