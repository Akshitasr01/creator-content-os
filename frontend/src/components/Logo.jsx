import { Link } from "react-router-dom";

/** Monochrome wordmark: black tile with a white "C" mark. */
export function LogoMark({ className = "size-7", inverted = false }) {
  const fg = inverted ? "#000" : "#fff";
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M20.5 11.2A6.5 6.5 0 1 0 20.5 20.8" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="16" r="1.8" fill={fg} />
    </svg>
  );
}

export default function Logo({ to = "/", compact = false, inverted = false }) {
  return (
    <Link to={to} className={`flex items-center gap-2.5 font-semibold tracking-tight ${inverted ? "text-paper" : "text-ink"}`}>
      <LogoMark className="size-7" inverted={inverted} />
      {!compact && <span className="text-[15px]">Creator Content OS</span>}
    </Link>
  );
}
