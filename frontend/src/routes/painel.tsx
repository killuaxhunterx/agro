import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import type { Painel as PainelData, PainelFiltro } from "#app/@types/api";
import { BarList, MonthlyChart } from "#app/components/ui/charts";
import { Input, Select } from "#app/components/ui/field";
import { Card, Kpi, PageHeader, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { QueryError } from "#app/routes/parts";
import { OnlyFor, useUser } from "#app/routes/shell";
import { clientesQuery, opcoesQuery, painelQuery } from "#app/services/api";
import { cx, formatBRL, formatData, hojeISO, mediaLabel } from "#app/utils/format";

const FILTROS = ["representante_id", "estado", "ramo", "produto", "cliente_id", "de", "ate"] as const;

function inicioMeses(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (n - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const DIAS_FEEDBACK = 30;

const PERIODOS = [
  { label: "3 meses", meses: 3 },
  { label: "6 meses", meses: 6 },
  { label: "12 meses", meses: 12 },
];

export function PainelPage() {
  return (
    <OnlyFor papel={["gestor", "representante"]}>
      <Painel />
    </OnlyFor>
  );
}

function Painel() {
  const u = useUser();
  const gestor = u.papel === "gestor";
  const [params, setParams] = useSearchParams();
  const filtro: PainelFiltro = {};
  for (const k of FILTROS) {
    const v = params.get(k);
    if (v) filtro[k] = v;
  }
  const opcoes = useQuery(opcoesQuery);
  const clientes = useQuery(clientesQuery);
  const q = useQuery(painelQuery(filtro));

  const set = (patch: Partial<Record<(typeof FILTROS)[number], string>>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };
  const algumFiltro = FILTROS.some((k) => k !== "de" && k !== "ate" && params.get(k));
  const nomeCliente = clientes.data?.find((c) => c.id === filtro.cliente_id)?.nome;

  return (
    <>
      <PageHeader
        eyebrow={gestor ? u.empresa_nome : "Meu desempenho"}
        title={gestor ? "Painel do gestor" : "Painel do representante"}
        subtitle={
          q.data
            ? `De ${formatData(q.data.de)} a ${formatData(q.data.ate)}. Clique numa barra para filtrar.`
            : undefined
        }
      />

      {/* Filtros numa linha só, acima de tudo — mudam todos os gráficos de uma vez. */}
      <Card className="mb-6 !p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {gestor ? (
            <Select label="Representante" value={filtro.representante_id ?? ""} onChange={(e) => set({ representante_id: e.target.value })}>
              <option value="">Todos</option>
              {(opcoes.data?.representantes ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          ) : null}
          <Select label="Região (estado)" value={filtro.estado ?? ""} onChange={(e) => set({ estado: e.target.value })}>
            <option value="">Todas</option>
            {(opcoes.data?.estados ?? []).map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
          <Select label="Atividade" value={filtro.ramo ?? ""} onChange={(e) => set({ ramo: e.target.value })}>
            <option value="">Todos</option>
            {(opcoes.data?.ramos ?? []).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select label="Produto" value={filtro.produto ?? ""} onChange={(e) => set({ produto: e.target.value })}>
            <option value="">Todos</option>
            {(opcoes.data?.produtos ?? []).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Input label="De" type="date" value={filtro.de ?? q.data?.de ?? ""} onChange={(e) => set({ de: e.target.value })} />
          <Input label="Até" type="date" value={filtro.ate ?? q.data?.ate ?? ""} onChange={(e) => set({ ate: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => {
            const ativo = filtro.de === inicioMeses(p.meses) || (!filtro.de && p.meses === 12);
            return (
              <button
                key={p.meses}
                type="button"
                aria-pressed={ativo}
                onClick={() => set({ de: inicioMeses(p.meses), ate: hojeISO() })}
                className={cx(
                  "rounded-full px-3 py-1.5 text-xs font-bold",
                  ativo ? "bg-brand text-white" : "bg-bg text-muted hover:text-text",
                )}
              >
                Últimos {p.label}
              </button>
            );
          })}
          {filtro.cliente_id ? (
            <button
              type="button"
              onClick={() => set({ cliente_id: "" })}
              className="rounded-full bg-field-green-soft px-3 py-1.5 text-xs font-bold text-field-green-deep"
            >
              Cliente: {nomeCliente ?? "…"} ✕
            </button>
          ) : null}
          {algumFiltro ? (
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="ml-auto text-xs font-bold text-brand hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </Card>

      {q.isPending ? (
        <PageLoading />
      ) : q.error ? (
        <QueryError error={q.error} />
      ) : (
        <Conteudo p={q.data} gestor={gestor} set={set} />
      )}
    </>
  );
}

function Conteudo({
  p,
  gestor,
  set,
}: {
  p: PainelData;
  gestor: boolean;
  set: (patch: Record<string, string>) => void;
}) {
  const total = p.mensal.reduce((s, m) => s + m.total_centavos, 0);
  const nVendas = p.mensal.reduce((s, m) => s + m.vendas, 0);
  // O feedback é por período: quem não recebe um há mais de DIAS_FEEDBACK dias está pendente.
  const limite = hojeISO(-DIAS_FEEDBACK);
  const semFeedback = p.equipe.filter((e) => !e.ultimo_feedback || e.ultimo_feedback.slice(0, 10) < limite).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Vendido no período" value={formatBRL(total)} hint={`${nVendas} vendas`} />
        <Kpi
          label="Visitas realizadas"
          value={p.visitas.realizadas}
          hint={`${p.visitas.primeiras_visitas} primeiras visitas · ${p.visitas.planejadas} planejadas à frente`}
        />
        <Kpi
          label="Pendências em aberto"
          value={p.acoes.abertas}
          tone={p.acoes.atrasadas > 0 ? "danger" : "neutral"}
          hint={p.acoes.atrasadas > 0 ? `! ${p.acoes.atrasadas} com prazo vencido` : "Nenhuma atrasada"}
        />
        <Kpi
          label={gestor ? "Sem feedback há mais de um mês" : "Visitas sem registro"}
          value={gestor ? semFeedback : p.visitas.sem_registro}
          tone={(gestor ? semFeedback : p.visitas.sem_registro) > 0 ? "danger" : "green"}
          hint={
            gestor ? (
              <Link to="/feedbacks" className="font-bold text-brand hover:underline">
                Dar feedback
              </Link>
            ) : (
              "A data passou e falta contar como foi"
            )
          }
        />
      </div>

      <Card>
        <SectionTitle>Vendas por mês</SectionTitle>
        <MonthlyChart data={p.mensal} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {gestor ? (
          <Card>
            <SectionTitle>Por vendedor</SectionTitle>
            <BarList
              items={p.por_representante.map((r) => ({
                key: r.id,
                label: r.nome,
                sub: `${r.vendas} vendas`,
                value: r.total_centavos,
                onClick: () => set({ representante_id: r.id }),
              }))}
            />
          </Card>
        ) : null}
        <Card>
          <SectionTitle>Por região</SectionTitle>
          <BarList
            items={p.por_estado.map((e) => ({
              key: e.estado,
              label: e.estado,
              sub: gestor ? `${e.representantes} representante${e.representantes > 1 ? "s" : ""}` : `${e.vendas} vendas`,
              value: e.total_centavos,
              onClick: () => set({ estado: e.estado }),
            }))}
          />
        </Card>
        <Card>
          <SectionTitle>Por produto</SectionTitle>
          <BarList
            items={p.por_produto.map((x) => ({
              key: x.produto,
              label: x.produto,
              sub: `${x.vendas} vendas`,
              value: x.total_centavos,
              onClick: () => set({ produto: x.produto }),
            }))}
          />
        </Card>
        <Card>
          <SectionTitle>Por cliente</SectionTitle>
          <BarList
            items={p.por_cliente.map((c) => ({
              key: c.id,
              label: c.nome,
              sub: c.estado,
              value: c.total_centavos,
              onClick: () => set({ cliente_id: c.id }),
            }))}
          />
        </Card>
      </div>

      {gestor && p.equipe.length > 0 ? (
        <Card>
          <SectionTitle>Equipe</SectionTitle>
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 pl-5 font-semibold sm:pl-0">Representante</th>
                  <th className="py-2 pr-3 text-right font-semibold">Visitas</th>
                  <th className="py-2 pr-3 text-right font-semibold">Vendido</th>
                  <th className="py-2 pr-3 text-right font-semibold">Pendências</th>
                  <th className="py-2 pr-3 text-right font-semibold">Atrasadas</th>
                  <th className="py-2 pr-3 text-right font-semibold">Média do feedback</th>
                  <th className="py-2 pr-5 text-right font-semibold sm:pr-0">Último feedback até</th>
                </tr>
              </thead>
              <tbody>
                {p.equipe.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 pl-5 font-semibold sm:pl-0">
                      <Link to={`/visitas?representante_id=${e.id}`} className="hover:underline">
                        {e.nome}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{e.visitas_realizadas}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatBRL(e.vendido_centavos)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{e.acoes_abertas}</td>
                    <td className={cx("py-2.5 pr-3 text-right tabular-nums", e.acoes_atrasadas > 0 && "font-bold text-danger")}>
                      {e.acoes_atrasadas > 0 ? `! ${e.acoes_atrasadas}` : 0}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{mediaLabel(e.media_feedback)}</td>
                    <td
                      className={cx(
                        "py-2.5 pr-5 text-right tabular-nums sm:pr-0",
                        (!e.ultimo_feedback || e.ultimo_feedback.slice(0, 10) < limite) && "font-bold text-danger",
                      )}
                    >
                      {e.ultimo_feedback ? formatData(e.ultimo_feedback) : "Nunca"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className={p.sem_compra.length > 0 ? "border-danger/40" : ""}>
        <SectionTitle>Clientes que pararam de comprar</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          Já compraram, mas não compram há mais de {p.dias_sem_compra} dias — antes de virar cliente perdido.
        </p>
        {p.sem_compra.length === 0 ? (
          <p className="text-sm font-semibold text-field-green-deep">✓ Nenhum cliente nessa situação.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.sem_compra.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clientes/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-border px-4 py-3 hover:border-border-strong"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{c.nome}</span>
                    <span className="block text-xs text-muted">
                      {c.estado}
                      {gestor ? ` · ${c.representante_nome}` : ""} · {formatBRL(c.total_centavos)} comprados até hoje
                    </span>
                  </span>
                  <span className="text-sm font-bold text-danger">! Última compra {formatData(c.ultima_compra)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
