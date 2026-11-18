import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { buttonClasses } from "#app/components/ui/button";
import { Input, Select } from "#app/components/ui/field";
import { Empty, PageHeader, Tag } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { QueryError } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { clientesQuery } from "#app/services/api";
import { SITUACAO, formatBRL, formatData } from "#app/utils/format";

export function ClientesLista() {
  const u = useUser();
  const q = useQuery(clientesQuery);
  const [busca, setBusca] = useState("");
  const [ramo, setRamo] = useState("");
  const [estado, setEstado] = useState("");

  const ramos = useMemo(() => [...new Set((q.data ?? []).map((c) => c.ramo).filter(Boolean))].sort(), [q.data]);
  const estados = useMemo(() => [...new Set((q.data ?? []).map((c) => c.estado))].sort(), [q.data]);

  if (q.isPending) return <PageLoading />;
  if (q.error) return <QueryError error={q.error} />;

  const termo = busca.trim().toLowerCase();
  const lista = q.data.filter(
    (c) =>
      (!termo || `${c.nome} ${c.cidade} ${c.contato_nome}`.toLowerCase().includes(termo)) &&
      (!ramo || c.ramo === ramo) &&
      (!estado || c.estado === estado),
  );

  return (
    <>
      <PageHeader
        eyebrow="Identificação"
        title="Clientes"
        subtitle={u.papel === "gestor" ? "Toda a carteira da equipe." : "Sua carteira de clientes e prospects."}
        actions={
          u.papel === "representante" ? (
            <Link to="/clientes/novo" className={buttonClasses("primary", "sm")}>
              + Cadastrar cliente
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Input label="Buscar" placeholder="Nome, cidade ou contato" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select label="Atividade" value={ramo} onChange={(e) => setRamo(e.target.value)}>
          <option value="">Todos</option>
          {ramos.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {estados.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>

      {lista.length === 0 ? (
        <Empty title={q.data.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente com esse filtro."} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Link
                to={`/clientes/${c.id}`}
                className="block h-full rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{c.nome}</p>
                    <p className="truncate text-xs text-muted">
                      {[c.cidade, c.estado].filter(Boolean).join(" · ")}
                      {c.ramo ? ` · ${c.ramo}` : ""}
                    </p>
                  </div>
                  <Tag tone={c.situacao === "cliente" ? "green" : "wheat"}>{SITUACAO[c.situacao]}</Tag>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Vendido</dt>
                    <dd className="font-bold tabular-nums">{formatBRL(c.total_vendido_centavos)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Última compra</dt>
                    <dd className="font-semibold">{formatData(c.ultima_compra)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Última visita</dt>
                    <dd className="font-semibold">{formatData(c.ultima_visita)}</dd>
                  </div>
                </dl>
                {u.papel === "gestor" ? <p className="mt-2 text-xs text-muted">Representante: {c.representante_nome}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
