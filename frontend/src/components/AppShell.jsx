import {
  ChevronsUpDown,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  SquarePen,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useToast } from "../hooks/useToast";
import { logoutUser } from "../services/auth";
import Logo from "./Logo";
import { Spinner } from "./ui";

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/create", label: "Create content", icon: SquarePen, match: ["/create", "/projects"] },
      { to: "/videos", label: "Video clips", icon: Clapperboard },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/settings", label: "Brand voice & settings", icon: Settings, end: true }],
  },
];

const PAGE_TITLES = [
  ["/dashboard", "Dashboard"],
  ["/create", "Create content"],
  ["/projects/new", "New text project"],
  ["/projects/", "Project"],
  ["/videos/new", "New video project"],
  ["/videos/", "Video project"],
  ["/videos", "Video clips"],
  ["/settings", "Brand voice & settings"],
];

function pageTitle(pathname) {
  if (pathname.endsWith("/studio")) return "Content studio";
  return PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] || "";
}

function NavItem({ item, pathname, onNavigate }) {
  const Icon = item.icon;
  const extraMatch = item.match?.some((prefix) => pathname.startsWith(prefix));
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
          isActive || extraMatch ? "bg-ink text-paper" : "text-subtle hover:bg-mist hover:text-ink"
        }`
      }
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

/** Name + email with a small menu that opens upwards (Settings, Sign out). */
function AccountMenu({ name, email, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open && (
        <div role="menu" className="absolute inset-x-0 bottom-full mb-2 animate-pop-in overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg">
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-graphite hover:bg-mist">
            <Settings className="size-4 text-muted" aria-hidden="true" /> Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-graphite hover:bg-mist disabled:opacity-60"
          >
            {signingOut ? <Spinner className="size-4" /> : <LogOut className="size-4 text-muted" aria-hidden="true" />}
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-mist"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper" aria-hidden="true">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name || "Your account"}</span>
          <span className="block truncate text-xs text-muted">{email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate, account }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo to="/dashboard" />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <AccountMenu {...account} />
      </div>
    </div>
  );
}

/** Sidebar + slim top bar + page container for every signed-in page. */
export default function AppShell() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const toast = useToast();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logoutUser();
    } catch (error) {
      toast.error(error.message);
      setSigningOut(false);
    }
  }

  const account = { name: profile?.creator_name, email: user?.email, onSignOut: handleLogout, signingOut };
  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-paper lg:block">
        <SidebarContent pathname={pathname} account={account} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-ink/30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside id="mobile-menu" className="relative h-full w-72 max-w-[85vw] animate-slide-in border-r border-line bg-paper shadow-xl">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-muted hover:bg-mist hover:text-ink"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent pathname={pathname} account={account} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-8">
            <button
              type="button"
              className="-ml-1.5 rounded-md p-1.5 text-subtle hover:bg-mist hover:text-ink lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <span className="lg:hidden">
              <Logo to="/dashboard" compact />
            </span>
            <p className="hidden truncate text-sm font-medium text-subtle sm:block">{title}</p>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/create"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-paper shadow-xs transition-colors hover:bg-graphite"
              >
                <Plus className="size-4" aria-hidden="true" /> New project
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
