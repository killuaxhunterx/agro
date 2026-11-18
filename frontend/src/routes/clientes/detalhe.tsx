import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { buttonClasses } from "#app/components/ui/button";
import { MonthlyChart } from "#app/components/ui/charts";
import { Card, Dado, Empty, PageHeader, SectionTitle, Tag } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { VendasTabela } from "#app/routes/vendas";
import { QueryError, VisitaItem } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { clienteQuery } from "#app/services/api";
import { SITUACAO, formatBRL, proximaVisita } from "#app/utils/format";

export function ClienteDetalhe() {
  const { id = "" } = useParams();
  const u = useUser();
  const q = useQuery(clienteQuery(id));
  if (q.isPending) return <PageLoading />;
  if (q.error) return <QueryError error={q.error} />;
  const { cliente: c, visitas, vendas } = q.data;

  const porMes = new Map<string, { total_centavos: number; vendas: number }>();
  for (const v of vendas) {
    const mes = `${v.data.slice(0, 7)}-01`;
    const cur = porMes.get(mes) ?? { total_centavos: 0, vendas: 0 };
    porMes.set(mes, { total_centavos: cur.total_centavos + v.valor_total_centavos, vendas: cur.vendas + 1 });
  }
  const mensal = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, s]) => ({ mes, ...s }));
  const total = vendas.reduce((s, v) => s + v.valor_total_centavos, 0);
  const endereco = [
    [c.rua, c.numero].filter(Boolean).join(", "),
    [c.cidade, c.estado].filter(Boolean).join(" / "),
    c.cep,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        eyebrow={c.ramo || "Cliente"}
        title={c.nome}
        subtitle={<Tag tone={c.situacao === "cliente" ? "green" : "wheat"}>{SITUACAO[c.situacao]}</Tag>}
        actions={
          u.papel === "representante" ? (
            <>
              <Link to={`/visitas/nova?cliente=${c.id}`} className={buttonClasses("primary", "sm")}>
                + Planejar visita
              </Link>
              <Link to={`/clientes/${c.id}/editar`} className={buttonClasses("outline", "sm")}>
                Editar
              </Link>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <SectionTitle>Identificação</SectionTitle>
          <dl className="flex flex-col gap-3">
            <Dado label="Visitas">{proximaVisita(c.visitas_no_cliente)}</Dado>
            <Dado label="Endereço">{endereco}</Dado>
            <Dado label="Contato">{c.contato_nome}</Dado>
            <Dado label="Telefone">{c.contato_telefone}</Dado>
            <Dado label="E-mail">{c.contato_email}</Dado>
            <Dado label="Atividade">{c.ramo}</Dado>
            <Dado label="Representante">{c.representante_nome}</Dado>
          </dl>
        </Card>

        <Card>
          <SectionTitle aside={<span className="text-sm font-bold tabular-nums">{formatBRL(total)} no total</span>}>
            Compras por mês
          </SectionTitle>
          <MonthlyChart data={mensal} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Visitas</SectionTitle>
          {visitas.length === 0 ? (
            <Empty title="Nenhuma visita ainda." />
          ) : (
            <ul className="flex flex-col gap-2">
              {visitas.map((v) => (
                <VisitaItem key={v.id} v={v} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle>Vendas</SectionTitle>
          <VendasTabela vendas={vendas} />
        </Card>
      </div>
    </>
  );
}
