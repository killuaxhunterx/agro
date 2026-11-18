import type { ReactNode } from "react";

import { cx } from "#app/utils/format";

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cx("min-w-0 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6", className)}>
      {children}
    </Tag>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold tracking-wider text-field-green-deep uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  n,
  children,
  aside,
}: {
  n?: number;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-3 text-lg font-extrabold text-brand">
        {n ? (
          <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-white">{n}</span>
        ) : null}
        {children}
      </h2>
      {aside}
    </div>
  );
}

type Tone = "neutral" | "brand" | "green" | "wheat" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "bg-bg text-muted",
  brand: "bg-brand-soft text-brand",
  green: "bg-field-green-soft text-field-green-deep",
  wheat: "bg-wheat-soft text-[#7a5410]",
  danger: "bg-danger-soft text-danger",
};

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", TONE[tone])}>
      {children}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="font-bold text-text">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "rounded-field px-4 py-3 text-sm font-semibold",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-field-green-soft text-field-green-deep",
      )}
    >
      {children}
    </div>
  );
}

/** Linha "rótulo: valor" dos resumos só-leitura. */
export function Dado({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] break-words whitespace-pre-line">{children || "—"}</dd>
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "danger" | "green";
}) {
  return (
    <div
      className={cx(
        "rounded-card border bg-surface p-4",
        tone === "danger" ? "border-danger/40" : tone === "green" ? "border-field-green/40" : "border-border",
      )}
    >
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p
        className={cx(
          "mt-1 text-2xl font-extrabold tabular-nums",
          tone === "danger" ? "text-danger" : tone === "green" ? "text-field-green-deep" : "text-text",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
