import { useEffect, useRef, useState } from "react";

import { cx, formatBRL, formatBRLCompacto, formatMes } from "#app/utils/format";

/**
 * Gráficos do painel. Todos de série única, então uma cor só (marsala) e sem legenda: o
 * título do cartão diz o que é medido. O valor sempre aparece em texto; a cor nunca
 * carrega informação sozinha.
 */

export type BarItem = { key: string; label: string; sub?: string; value: number; onClick?: () => void };

/** Barras horizontais com rótulo e valor diretos — ranking por representante, região, produto, cliente. */
export function BarList({
  items,
  format = formatBRL,
  empty = "Sem vendas no filtro escolhido.",
}: {
  items: BarItem[];
  format?: (n: number) => string;
  empty?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => {
        const pct = Math.max((i.value / max) * 100, 1.5);
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">
                {i.label}
                {i.sub ? <span className="ml-1.5 font-normal text-muted">{i.sub}</span> : null}
              </span>
              <span className="shrink-0 font-bold tabular-nums">{format(i.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-bg">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={i.key}>
            {i.onClick ? (
              <button
                type="button"
                onClick={i.onClick}
                title={`Filtrar por ${i.label}`}
                className="block w-full rounded-md text-left hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Vendas mês a mês: colunas sobre uma linha de base, com tooltip ao passar o dedo/mouse. */
export function MonthlyChart({ data }: { data: { mes: string; total_centavos: number; vendas: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Desenha na largura real do contêiner: o texto fica sempre em 11px, sem escalar com o SVG.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(Math.round(e.contentRect.width), 280)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted">Sem vendas no filtro escolhido.</p>;

  const H = 240;
  const pad = { top: 16, right: 8, bottom: 28, left: 68 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.total_centavos), 1));
  const step = innerW / data.length;
  const barW = Math.min(36, step * 0.6);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const sel = hover === null ? null : data[hover];

  return (
    <div ref={box} className="relative">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block max-w-full"
        role="img"
        aria-label={`Vendas por mês: ${data.map((d) => `${formatMes(d.mes)} ${formatBRL(d.total_centavos)}`).join("; ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {formatBRLCompacto(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx0 = pad.left + step * i + step / 2;
          const top = y(d.total_centavos);
          const h = Math.max(pad.top + innerH - top, 1);
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              {/* área de toque maior que a barra */}
              <rect x={cx0 - step / 2} y={pad.top} width={step} height={innerH} fill="transparent" />
              <path
                d={roundedTop(cx0 - barW / 2, top, barW, h, 4)}
                className={cx("transition-opacity", hover !== null && hover !== i ? "opacity-40" : "")}
                fill="var(--color-brand)"
              />
              {step >= 40 || i % 2 === 0 ? (
                <text x={cx0} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {formatMes(d.mes)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {sel && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-field border border-border bg-surface px-3 py-2 text-xs shadow-card"
          style={{
            left: `${((pad.left + step * hover + step / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-bold">{formatMes(sel.mes)}</p>
          <p className="tabular-nums">{formatBRL(sel.total_centavos)}</p>
          <p className="text-muted">
            {sel.vendas} {sel.vendas === 1 ? "venda" : "vendas"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function niceMax(v: number): number {
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

/** Retângulo com só o topo arredondado — a ponta do dado; a base fica presa na linha. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
