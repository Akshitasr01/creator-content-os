import { Link } from "react-router-dom";

export default function Logo({ to = "/" }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
        C
      </span>
      <span>Creator Content OS</span>
    </Link>
  );
}
