/**
 * Small, reusable UI primitives. Every page uses these so the app looks
 * consistent. Monochrome palette tokens are defined in index.css.
 */
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight, Info, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

const BUTTON_VARIANTS = {
  primary: "bg-ink text-paper hover:bg-graphite active:bg-charcoal shadow-xs",
  secondary: "bg-paper text-ink border border-line hover:border-muted/60 hover:bg-mist shadow-xs",
  ghost: "text-subtle hover:bg-mist hover:text-ink",
  link: "text-ink underline-offset-4 hover:underline px-0! h-auto!",
  danger: "bg-danger text-paper hover:bg-danger/90 shadow-xs",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner({ label = "Loading…" }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted" role="status">
      <Spinner className="size-6 text-ink" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const FIELD_CLASSES =
  "block w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink shadow-xs transition-colors placeholder:text-muted hover:border-muted/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:bg-mist disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger";

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, required, children, className = "" }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span className="text-muted"> *</span>}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, required, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => <input className={FIELD_CLASSES} required={required} {...a11y} {...props} />}
    </Field>
  );
}

export function TextArea({ label, hint, error, required, className, rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <textarea rows={rows} className={`${FIELD_CLASSES} resize-y leading-relaxed`} required={required} {...a11y} {...props} />
      )}
    </Field>
  );
}

export function Select({ label, hint, error, required, className, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <select className={`${FIELD_CLASSES} cursor-pointer`} required={required} {...a11y} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <section className={`rounded-xl border border-line bg-paper shadow-xs ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/*
 * Badge tones keep their old names so existing callers work, but all are
 * monochrome: emphasis comes from fill/outline weight, not hue.
 */
const BADGE_TONES = {
  slate: "bg-mist text-subtle border-line",
  brand: "bg-paper text-ink border-ink/20",
  green: "bg-ink text-paper border-ink",
  amber: "bg-paper text-ink border-dashed border-muted",
  red: "bg-danger-soft text-danger border-danger/25",
  blue: "bg-paper text-subtle border-line",
};

export function Badge({ tone = "slate", children, className = "", title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone] || BADGE_TONES.slate} ${className}`}
    >
      {children}
    </span>
  );
}

/** Shown on anything produced by the free mock provider. */
export function DemoBadge() {
  return (
    <Badge tone="amber" title="Created by the free demo provider, not by AI. Set AI_PROVIDER=openai for real generation.">
      Demo output
    </Badge>
  );
}

const ALERT_TONES = {
  error: { box: "border-danger/25 bg-danger-soft text-danger", Icon: AlertCircle },
  warning: { box: "border-line bg-paper text-ink", Icon: TriangleAlert },
  info: { box: "border-line bg-mist text-graphite", Icon: Info },
  success: { box: "border-ink/15 bg-paper text-ink", Icon: CheckCircle2 },
};

export function Alert({ tone = "error", title, children, action, className = "" }) {
  const { box, Icon } = ALERT_TONES[tone] || ALERT_TONES.info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center ${box} ${className}`}
    >
      <div className="flex flex-1 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Square icon holder used in empty states, feature lists and stat cards. */
export function IconTile({ icon: Icon, className = "", inverted = false }) {
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
        inverted ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
      } ${className}`}
      aria-hidden="true"
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </div>
  );
}

export function EmptyState({ icon = Sparkles, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-paper px-6 py-16 text-center">
      {typeof icon === "string" ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-line text-lg" aria-hidden="true">
          {icon}
        </div>
      ) : (
        <IconTile icon={icon} className="mb-4" />
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Accessible modal built on the native <dialog> element. */
export function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-md p-1 text-muted transition-colors hover:bg-mist hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Segmented tabs: active = black with white text, inactive = white,
 * hover = light grey. `items` is [{ value, label, count? }].
 */
export function Tabs({ items, value, onChange, label, className = "" }) {
  return (
    <div role="tablist" aria-label={label} className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-paper p-1 ${className}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors ${
              active ? "bg-ink text-paper" : "text-subtle hover:bg-mist hover:text-ink"
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`tabular-nums ${active ? "text-paper/70" : "text-muted"}`}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Collapsible panel (native <details>) with a rotating chevron. */
export function Disclosure({ summary, children, className = "", bodyClassName = "" }) {
  return (
    <details className={`group rounded-xl border border-line bg-paper shadow-xs ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium text-graphite transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
        {summary}
      </summary>
      <div className={`animate-fade-in border-t border-line ${bodyClassName}`}>{children}</div>
    </details>
  );
}

/**
 * Horizontal progress steps. `steps` is [{ label, state }] with state
 * "done" | "active" | "todo". Done = black check, active = black ring.
 */
export function Steps({ steps, className = "" }) {
  return (
    <ol className={`flex flex-wrap items-center gap-x-2 gap-y-3 text-[13px] ${className}`}>
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-2">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors ${
              step.state === "done"
                ? "border-ink bg-ink text-paper"
                : step.state === "active"
                  ? "border-ink bg-paper text-ink ring-2 ring-ink/10"
                  : "border-line bg-paper text-muted"
            }`}
            aria-hidden="true"
          >
            {step.state === "done" ? <Check className="size-3.5" /> : index + 1}
          </span>
          <span className={step.state === "todo" ? "text-muted" : "font-medium text-ink"}>
            {step.label}
            {step.state === "active" && <span className="sr-only"> (current step)</span>}
            {step.state === "done" && <span className="sr-only"> (done)</span>}
          </span>
          {index < steps.length - 1 && <span className="mx-1 hidden h-px w-8 bg-line sm:block" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

/**
 * Button that opens a small animated menu. `items` is [{ value, label }];
 * `onSelect(value)` fires on click. Closes on outside click and Escape.
 */
export function DropdownMenu({ label, icon: Icon, items, onSelect, disabled, align = "left", size = "sm" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();

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

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size={size}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
        <ChevronDown className={`size-3.5 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-20 mt-1.5 min-w-52 animate-pop-in overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(item.value);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-graphite transition-colors hover:bg-mist hover:text-ink focus-visible:bg-mist focus-visible:outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small "← Back" link used as a PageHeader eyebrow. */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px] sm:leading-tight">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-muted sm:text-[15px]">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
