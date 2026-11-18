import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Empty, PageHeader } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { AcaoItem, QueryError } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { acoesQuery } from "#app/services/api";
import { cx, hojeISO } from "#app/utils/format";

export function Pendencias() {
  const u = useUser();
  const [todas, setTodas] = useState(false);
  const q = useQuery(acoesQuery(!todas));
  const gestor = u.papel === "gestor";
  const hoje = hojeISO();
  const atrasadas = (q.data ?? []).filter((a) => !a.concluida_em && a.prazo && a.prazo.slice(0, 10) < hoje).length;

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento"
        title="Pendências"
        subtitle={
          gestor
            ? "Tudo o que a equipe ficou de fazer pelos clientes, com prazo."
            : "O que você ficou de fazer pelos clientes. Marque quando concluir."
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { v: false, label: "Em aberto" },
          { v: true, label: "Todas" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={todas === o.v}
            onClick={() => setTodas(o.v)}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-bold",
              todas === o.v ? "bg-brand text-white" : "bg-surface text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        ))}
        {atrasadas > 0 ? <span className="ml-2 text-sm font-bold text-danger">! {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span> : null}
      </div>
      {q.isPending ? (
        <PageLoading />
      ) : q.error ? (
        <QueryError error={q.error} />
      ) : q.data.length === 0 ? (
        <Empty title={todas ? "Nenhuma pendência registrada." : "Nenhuma pendência em aberto."} />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((a) => (
            <AcaoItem key={a.id} a={a} canEdit={!gestor} showRep={gestor} />
          ))}
        </ul>
      )}
    </>
  );
}
