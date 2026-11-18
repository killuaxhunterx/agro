import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import { buttonClasses } from "#app/components/ui/button";
import { Select } from "#app/components/ui/field";
import { Empty, PageHeader } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { QueryError, VisitaItem } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { opcoesQuery, visitasQuery } from "#app/services/api";
import { hojeISO } from "#app/utils/format";

const STATUS = {
  "": "Todas",
  planejadas: "Planejadas",
  sem_registro: "Sem registro",
  realizadas: "Realizadas",
} as const;
type Status = keyof typeof STATUS;

export function VisitasLista() {
  const u = useUser();
  const gestor = u.papel === "gestor";
  const [params, setParams] = useSearchParams();
  const rep = params.get("representante_id") ?? "";
  const status = (params.get("status") ?? "") as Status;
  const opcoes = useQuery({ ...opcoesQuery, enabled: gestor });
  const q = useQuery(visitasQuery(rep ? { representante_id: rep } : {}));

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const hoje = hojeISO();
  const lista = (q.data ?? []).filter((v) => {
    const dia = v.data.slice(0, 10);
    switch (status) {
      case "planejadas":
        return !v.realizada_em && dia >= hoje;
      case "sem_registro":
        return !v.realizada_em && dia < hoje;
      case "realizadas":
        return Boolean(v.realizada_em);
      default:
        return true;
    }
  });

  return (
    <>
      <PageHeader
        eyebrow={gestor ? "Equipe" : "Histórico"}
        title="Visitas"
        subtitle={gestor ? "Tudo o que a equipe planejou e realizou. O feedback é dado por período, em Feedback." : undefined}
        actions={
          !gestor ? (
            <Link to="/visitas/nova" className={buttonClasses("primary", "sm")}>
              + Planejar visita
            </Link>
          ) : null
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {gestor ? (
          <Select label="Representante" value={rep} onChange={(e) => setParam("representante_id", e.target.value)}>
            <option value="">Todos</option>
            {(opcoes.data?.representantes ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        ) : null}
        <Select label="Situação" value={status} onChange={(e) => setParam("status", e.target.value)}>
          {(Object.keys(STATUS) as Status[]).map((k) => (
            <option key={k} value={k}>
              {STATUS[k]}
            </option>
          ))}
        </Select>
      </div>
      {q.isPending ? (
        <PageLoading />
      ) : q.error ? (
        <QueryError error={q.error} />
      ) : lista.length === 0 ? (
        <Empty title="Nenhuma visita com esse filtro." />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((v) => (
            <VisitaItem key={v.id} v={v} showRep={gestor} />
          ))}
        </ul>
      )}
    </>
  );
}
