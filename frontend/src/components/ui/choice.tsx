import { useId } from "react";

import { ESCALA, cx } from "#app/utils/format";

type Option<T extends string> = { value: T; label: string; hint?: string };

/**
 * Marcação de uma opção só, em cartões grandes — o "assinalar ( )" do formulário em papel,
 * fácil de acertar com o dedão na estrada.
 */
export function RadioCards<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  legend: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null;
  columns?: 1 | 2 | 3;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-text">{legend}</legend>
      <div
        className={cx(
          "grid gap-2",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
        )}
      >
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-field border-[1.5px] px-4 py-3 transition-colors",
                checked ? "border-brand bg-brand-soft" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="mt-0.5 size-4 accent-brand"
              />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{o.label}</span>
                {o.hint ? <span className="text-xs text-muted">{o.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className="text-xs font-semibold text-danger max-sm:text-sm">⚠ {error}</p> : null}
    </fieldset>
  );
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-text">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors",
                checked
                  ? "border-field-green bg-field-green-soft text-field-green-deep"
                  : "border-border bg-surface text-text hover:border-border-strong",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className="size-4 accent-field-green"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A escala de referência 1–4 do feedback do gestor. Par de propósito: sem "nota do meio". */
export function ScalePicker({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {ESCALA.map((e) => {
          const checked = value === e.nota;
          return (
            <label
              key={e.nota}
              title={`${e.titulo} — ${e.descricao}`}
              className={cx(
                "flex cursor-pointer flex-col items-center rounded-field border-[1.5px] px-1 py-2 text-center transition-colors",
                checked ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(e.nota)}
              />
              <span className="text-lg font-extrabold tabular-nums">{e.nota}</span>
              <span className={cx("text-[11px] leading-tight", checked ? "text-white" : "text-muted")}>
                {e.titulo}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Uma nota já dada, só leitura. */
export function NotaBadge({ nota }: { nota: number }) {
  const e = ESCALA.find((x) => x.nota === nota);
  const tone =
    nota >= 4
      ? "bg-field-green text-white"
      : nota === 3
        ? "bg-field-green-soft text-field-green-deep"
        : nota === 2
          ? "bg-wheat-soft text-text"
          : "bg-danger-soft text-danger";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", tone)}>
      <span className="tabular-nums">{nota}</span>
      {e ? <span className="font-semibold">{e.titulo}</span> : null}
    </span>
  );
}
