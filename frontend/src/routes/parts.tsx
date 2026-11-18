import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import type { Acao, VisitaLista } from "#app/@types/api";
import { Tag } from "#app/components/ui/layout";
import { toast } from "#app/components/ui/toast";
import { concluirAcao, invalidateCampo } from "#app/services/api";
import { MOTIVO_CURTO, cx, formatData, hojeISO } from "#app/utils/format";

/** Estado de uma visita, por texto e forma — nunca só pela cor. */
export function StatusVisita({ v }: { v: Pick<VisitaLista, "realizada_em" | "data"> }) {
  if (v.realizada_em) return <Tag tone="green">✓ Realizada</Tag>;
  return v.data.slice(0, 10) < hojeISO() ? <Tag tone="danger">! Sem registro</Tag> : <Tag tone="wheat">Planejada</Tag>;
}

export function VisitaItem({ v, showRep }: { v: VisitaLista; showRep?: boolean }) {
  return (
    <li>
      <Link
        to={`/visitas/${v.id}`}
        className="flex items-center gap-4 rounded-field border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
      >
        <div className="w-14 shrink-0 text-center">
          <p className="text-lg leading-none font-extrabold text-brand tabular-nums">{formatData(v.data).slice(0, 5)}</p>
          <p className="mt-1 text-[11px] text-muted">{v.horario || "—"}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{v.cliente_nome}</p>
          <p className="truncate text-xs text-muted">
            {MOTIVO_CURTO[v.motivo]} · {v.cliente_estado}
            {showRep ? ` · ${v.representante_nome}` : ""}
            {v.acoes_abertas > 0 ? ` · ${v.acoes_abertas} pendência${v.acoes_abertas > 1 ? "s" : ""}` : ""}
          </p>
          <span className="mt-1.5 block sm:hidden">
            <StatusVisita v={v} />
          </span>
        </div>
        <span className="max-sm:hidden">
          <StatusVisita v={v} />
        </span>
      </Link>
    </li>
  );
}

export function AcaoItem({ a, canEdit, showRep }: { a: Acao; canEdit: boolean; showRep?: boolean }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (c: boolean) => concluirAcao(a.id, c),
    onSuccess: (_, c) => {
      invalidateCampo(qc);
      if (c) toast.success("Pendência concluída.");
    },
    onError: (e) => toast.error(e.message),
  });
  const feita = Boolean(a.concluida_em);
  const atrasada = !feita && a.prazo !== null && a.prazo.slice(0, 10) < hojeISO();
  return (
    <li
      className={cx(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-field border bg-surface px-4 py-3",
        atrasada ? "border-danger/40" : "border-border",
      )}
    >
      {canEdit ? (
        <input
          type="checkbox"
          aria-label={feita ? `Reabrir: ${a.o_que}` : `Concluir: ${a.o_que}`}
          checked={feita}
          disabled={m.isPending}
          onChange={(e) => m.mutate(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-field-green"
        />
      ) : (
        <span aria-hidden="true" className="mt-0.5 text-lg leading-none">
          {feita ? "✓" : "○"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cx("font-bold", feita && "text-muted line-through")}>{a.o_que}</p>
        <p className="text-xs text-muted">
          <Link to={`/visitas/${a.visita_id}`} className="underline-offset-2 hover:underline">
            {a.cliente_nome}
          </Link>
          {showRep ? ` · ${a.representante_nome}` : ""}
          {a.com_quem ? ` · com ${a.com_quem}` : ""}
          {a.resultado ? ` · para: ${a.resultado}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right max-sm:basis-full max-sm:pl-8 max-sm:text-left">
        {feita ? (
          <Tag tone="green">Feita {formatData(a.concluida_em)}</Tag>
        ) : atrasada ? (
          <Tag tone="danger">! Atrasada · {formatData(a.prazo)}</Tag>
        ) : (
          <Tag tone="wheat">Até {formatData(a.prazo)}</Tag>
        )}
      </div>
    </li>
  );
}

export function QueryError({ error }: { error: Error }) {
  return (
    <div role="alert" className="rounded-field bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
      {error.message}
    </div>
  );
}
