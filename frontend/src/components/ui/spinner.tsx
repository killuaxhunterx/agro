import { cx } from "#app/utils/format";

export function Spinner({
  size = "md",
  label = "Carregando…",
}: {
  size?: "sm" | "md";
  label?: string | null;
}) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cx("animate-spin", size === "sm" ? "size-4" : "size-6")}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="text-sm text-muted">{label}</span> : null}
    </span>
  );
}

export function PageLoading() {
  return (
    <div className="flex justify-center py-16 text-brand">
      <Spinner />
    </div>
  );
}
