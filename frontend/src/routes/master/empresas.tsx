import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "#app/components/ui/button";
import { Input } from "#app/components/ui/field";
import { Alert, Card, Empty, PageHeader, Tag } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { QueryError } from "#app/routes/parts";
import { OnlyFor } from "#app/routes/shell";
import { criarEmpresa, empresasQuery, keys } from "#app/services/api";

export function Empresas() {
  return (
    <OnlyFor papel="master">
      <Inner />
    </OnlyFor>
  );
}

function Inner() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery(empresasQuery);
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("5");
  const m = useMutation({
    mutationFn: () => criarEmpresa(nome, Number(limite)),
    onSuccess: (e) => {
      void qc.invalidateQueries({ queryKey: keys.empresas });
      void navigate(`/empresas/${e.id}`);
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Consultoria"
        title="Empresas"
        subtitle="Cada indústria contrata um número de representantes. Só a consultoria altera esse limite."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          {q.isPending ? (
            <PageLoading />
          ) : q.error ? (
            <QueryError error={q.error} />
          ) : q.data.length === 0 ? (
            <Empty title="Nenhuma empresa ainda." />
          ) : (
            <ul className="flex flex-col gap-2">
              {q.data.map((e) => {
                const cheio = e.representantes_ativos >= e.limite_representantes;
                return (
                  <li key={e.id}>
                    <Link
                      to={`/empresas/${e.id}`}
                      className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-5 py-4 hover:border-border-strong"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{e.nome}</span>
                        <span className="block text-xs text-muted">
                          {e.gestores_ativos} gestor{e.gestores_ativos === 1 ? "" : "es"}
                        </span>
                      </span>
                      <Tag tone={cheio ? "wheat" : "green"}>
                        {e.representantes_ativos} de {e.limite_representantes} representantes
                      </Tag>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Card>
          <h2 className="mb-4 font-extrabold text-brand">Nova empresa</h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <Input label="Nome da empresa" required value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input
              label="Representantes contratados"
              type="number"
              min={0}
              required
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
            {m.error ? <Alert>{m.error.message}</Alert> : null}
            <Button type="submit" loading={m.isPending}>
              Criar empresa
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
