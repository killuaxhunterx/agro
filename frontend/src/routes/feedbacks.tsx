import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import type { Aplicacao, Feedback, FeedbackInput, FeedbackLista } from "#app/@types/api";
import { Button, buttonClasses } from "#app/components/ui/button";
import { NotaBadge, RadioCards, ScalePicker } from "#app/components/ui/choice";
import { Input, Select, Textarea } from "#app/components/ui/field";
import { Alert, Card, Empty, Kpi, PageHeader, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { toast } from "#app/components/ui/toast";
import { QueryError, VisitaItem } from "#app/routes/parts";
import { OnlyFor, useUser } from "#app/routes/shell";
import {
  criarFeedback,
  editarFeedback,
  feedbackPeriodoQuery,
  feedbackQuery,
  feedbacksQuery,
  invalidateCampo,
  opcoesQuery,
} from "#app/services/api";
import { APLICACAO, ESCALA, ITENS_FEEDBACK, cx, diaISO, formatBRL, formatData, hojeISO, mediaLabel } from "#app/utils/format";

/*
 * O feedback do gestor é por período, não por visita: como numa avaliação de desempenho, ele
 * reúne tudo o que o representante fez em um mês, um mês e meio, e avalia cada item no geral.
 * Na justificativa ele cita a visita que quiser.
 */

const periodo = (f: { de: string; ate: string }) => `${formatData(f.de)} a ${formatData(f.ate)}`;

/** Dia seguinte a uma data "AAAA-MM-DD", sem fuso. */
function diaSeguinte(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1));
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- lista

export function FeedbacksLista() {
  return (
    <OnlyFor papel={["gestor", "representante"]}>
      <Lista />
    </OnlyFor>
  );
}

function Lista() {
  const u = useUser();
  const gestor = u.papel === "gestor";
  const [params, setParams] = useSearchParams();
  const rep = params.get("representante_id") ?? "";
  const opcoes = useQuery({ ...opcoesQuery, enabled: gestor });
  const todos = useQuery(feedbacksQuery());

  if (todos.isPending) return <PageLoading />;
  if (todos.error) return <QueryError error={todos.error} />;
  const lista = rep ? todos.data.filter((f) => f.representante_id === rep) : todos.data;

  return (
    <>
      <PageHeader
        eyebrow={gestor ? "Equipe" : "Seu desempenho"}
        title="Feedback do gestor"
        subtitle={
          gestor
            ? "Não é visita por visita: junte o que cada representante fez no período e avalie de uma vez."
            : "As avaliações do gestor sobre o conjunto das suas visitas em cada período."
        }
        actions={
          gestor ? (
            <Link to="/feedbacks/novo" className={buttonClasses("primary", "sm")}>
              + Dar feedback
            </Link>
          ) : null
        }
      />

      {gestor ? <Equipe feedbacks={todos.data} representantes={opcoes.data?.representantes ?? []} /> : null}

      <Card>
        <SectionTitle
          aside={
            gestor ? (
              <Select
                label="Representante"
                className="min-w-48"
                value={rep}
                onChange={(e) => setParams(e.target.value ? { representante_id: e.target.value } : {}, { replace: true })}
              >
                <option value="">Todos</option>
                {(opcoes.data?.representantes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            ) : null
          }
        >
          {gestor ? "Feedbacks dados" : "Feedbacks recebidos"}
        </SectionTitle>
        {lista.length === 0 ? (
          <Empty title="Nenhum feedback ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((f) => (
              <FeedbackItem key={f.id} f={f} showRep={gestor} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Quem está há mais tempo sem feedback aparece primeiro. */
function Equipe({
  feedbacks,
  representantes,
}: {
  feedbacks: FeedbackLista[];
  representantes: { id: string; nome: string; ativo: boolean }[];
}) {
  const limite = hojeISO(-30);
  const linhas = representantes
    .filter((r) => r.ativo)
    .map((r) => ({ ...r, ultimo: feedbacks.find((f) => f.representante_id === r.id)?.ate.slice(0, 10) ?? null }))
    .sort((a, b) => (a.ultimo ?? "").localeCompare(b.ultimo ?? ""));
  if (linhas.length === 0) return null;
  return (
    <Card className="mb-6">
      <SectionTitle>Equipe</SectionTitle>
      <ul className="flex flex-col gap-2">
        {linhas.map((r) => {
          const atrasado = !r.ultimo || r.ultimo < limite;
          return (
            <li
              key={r.id}
              className={cx(
                "flex flex-wrap items-center justify-between gap-3 rounded-field border px-4 py-3",
                atrasado ? "border-danger/40" : "border-border",
              )}
            >
              <span className="min-w-0">
                <span className="block font-bold">{r.nome}</span>
                <span className={cx("block text-xs", atrasado ? "font-semibold text-danger" : "text-muted")}>
                  {r.ultimo ? `${atrasado ? "! " : ""}Último feedback cobre até ${formatData(r.ultimo)}` : "! Nunca recebeu feedback"}
                </span>
              </span>
              <Link to={`/feedbacks/novo?representante_id=${r.id}`} className={buttonClasses(atrasado ? "primary" : "outline", "sm")}>
                Dar feedback
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function FeedbackItem({ f, showRep }: { f: FeedbackLista; showRep: boolean }) {
  return (
    <li>
      <Link
        to={`/feedbacks/${f.id}`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
      >
        <span className="min-w-0">
          <span className="block font-bold">{showRep ? f.representante_nome : periodo(f)}</span>
          <span className="block truncate text-xs text-muted">
            {showRep ? `${periodo(f)} · ` : ""}por {f.gestor_nome}
            {f.orientacao ? ` · “${f.orientacao}”` : ""}
          </span>
        </span>
        <span className="text-sm font-bold tabular-nums">{mediaLabel(f.media)}</span>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------- novo

export function FeedbackNovo() {
  return (
    <OnlyFor papel="gestor">
      <Novo />
    </OnlyFor>
  );
}

function Novo() {
  const [params, setParams] = useSearchParams();
  const rep = params.get("representante_id") ?? "";
  const opcoes = useQuery(opcoesQuery);
  const anteriores = useQuery({ ...feedbacksQuery(rep), enabled: Boolean(rep) });

  // O período padrão começa no dia seguinte ao último feedback (ou 30 dias atrás) e vai até hoje.
  const ultimo = anteriores.data?.[0]?.ate;
  const hoje = hojeISO();
  let deInicial = ultimo ? diaSeguinte(diaISO(ultimo)) : hojeISO(-30);
  if (deInicial > hoje) deInicial = hojeISO(-30);

  return (
    <>
      <PageHeader eyebrow="Feedback do gestor" title="Dar feedback" subtitle="Escolha o representante e o período que vai avaliar." />
      <div className="flex max-w-4xl flex-col gap-6">
        <Card>
          <Select
            label="Representante"
            required
            value={rep}
            onChange={(e) => setParams(e.target.value ? { representante_id: e.target.value } : {}, { replace: true })}
          >
            <option value="">Escolha…</option>
            {(opcoes.data?.representantes ?? [])
              .filter((r) => r.ativo || r.id === rep)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
          </Select>
          {ultimo ? <p className="mt-2 text-xs text-muted">O último feedback dele cobre até {formatData(ultimo)}.</p> : null}
        </Card>
        {!rep ? null : anteriores.isPending ? (
          <PageLoading />
        ) : (
          <FeedbackEditor key={rep} representanteId={rep} deInicial={deInicial} ateInicial={hoje} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- editor (novo e edição)

function inicial(rep: string, de: string, ate: string, f?: Feedback): FeedbackInput {
  const item = (n: number | undefined, j: string | undefined) => ({ nota: n ?? 0, justificativa: j ?? "" });
  return {
    representante_id: rep,
    de,
    ate,
    planejamento: item(f?.nota_planejamento, f?.just_planejamento),
    resultados: item(f?.nota_resultados, f?.just_resultados),
    aspectos_positivos: item(f?.nota_aspectos_positivos, f?.just_aspectos_positivos),
    oportunidades: item(f?.nota_oportunidades, f?.just_oportunidades),
    pontos_melhorar: item(f?.nota_pontos_melhorar, f?.just_pontos_melhorar),
    pendencias: item(f?.nota_pendencias, f?.just_pendencias),
    orientacao: f?.orientacao ?? "",
    orientacao_anterior_aplicada: f?.orientacao_anterior_aplicada ?? null,
  };
}

function FeedbackEditor({
  representanteId,
  deInicial,
  ateInicial,
  existente,
  onCancel,
}: {
  representanteId: string;
  deInicial: string;
  ateInicial: string;
  existente?: Feedback;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState<FeedbackInput>(() => inicial(representanteId, deInicial, ateInicial, existente));
  const [erro, setErro] = useState<string | null>(null);
  const periodoValido = Boolean(f.de && f.ate && f.de <= f.ate);
  const ctx = useQuery({
    ...feedbackPeriodoQuery({
      representante_id: representanteId,
      de: f.de,
      ate: f.ate,
      ...(existente ? { excluir_id: existente.id } : {}),
    }),
    enabled: periodoValido,
  });

  const m = useMutation({
    mutationFn: () => {
      if (!periodoValido) throw new Error("O início do período é depois do fim.");
      if (ITENS_FEEDBACK.some((i) => f[i.key].nota === 0)) throw new Error("Dê uma nota de 1 a 4 para cada item.");
      const corpo = ctx.data?.orientacao_anterior ? f : { ...f, orientacao_anterior_aplicada: null };
      return existente ? editarFeedback(existente.id, corpo) : criarFeedback(corpo);
    },
    onSuccess: (salvo) => {
      invalidateCampo(qc);
      setErro(null);
      toast.success(existente ? "Feedback atualizado." : "Feedback enviado ao representante.");
      if (existente) onCancel?.();
      else void navigate(`/feedbacks/${salvo.id}`, { replace: true });
    },
    onError: (e) => setErro(e.message),
  });

  const p = ctx.data;
  const realizadas = p?.visitas.filter((v) => v.realizada_em) ?? [];
  const semRegistro = p?.visitas.filter((v) => !v.realizada_em && v.data.slice(0, 10) < hojeISO()).length ?? 0;
  const vendido = p?.vendas.reduce((s, v) => s + v.valor_total_centavos, 0) ?? 0;
  const abertas = p?.acoes.filter((a) => !a.concluida_em) ?? [];
  const atrasadas = abertas.filter((a) => a.prazo !== null && a.prazo.slice(0, 10) < hojeISO()).length;

  return (
    <>
      <Card>
        <SectionTitle n={1}>Período avaliado</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="De" type="date" required value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
          <Input label="Até" type="date" required value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
        </div>
        {!periodoValido ? <p className="mt-2 text-sm font-semibold text-danger">⚠ O início do período é depois do fim.</p> : null}
      </Card>

      <Card>
        <SectionTitle n={2}>O que {p?.representante.nome ?? "ele"} fez no período</SectionTitle>
        {ctx.error ? (
          <QueryError error={ctx.error} />
        ) : !p ? (
          <PageLoading />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Visitas realizadas" value={realizadas.length} hint={semRegistro > 0 ? `! ${semRegistro} sem registro` : undefined} />
              <Kpi label="Vendido" value={formatBRL(vendido)} hint={`${p.vendas.length} vendas`} />
              <Kpi label="Pendências em aberto" value={abertas.length} tone={atrasadas > 0 ? "danger" : "neutral"} hint={atrasadas > 0 ? `! ${atrasadas} atrasadas` : undefined} />
              <Kpi label="Próximos passos registrados" value={p.acoes.length} />
            </div>
            {realizadas.length === 0 ? (
              <Empty title="Nenhuma visita realizada nesse período." />
            ) : (
              <>
                <p className="mb-2 text-sm text-muted">Abra as visitas para ler o planejamento, a realização e o acompanhamento.</p>
                <ul className="flex flex-col gap-2">
                  {realizadas.map((v) => (
                    <VisitaItem key={v.id} v={v} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Card>

      <Card className="border-brand/30">
        <SectionTitle n={3}>Feedback</SectionTitle>
        <p className="-mt-2 mb-5 text-sm text-muted">
          Avalie cada item no geral do período e justifique — pode citar a visita e pode falar em vez de escrever.
        </p>

        {p?.orientacao_anterior ? (
          <div className="mb-6 rounded-field bg-wheat-soft p-4">
            <p className="text-xs font-bold text-[#7a5410] uppercase">Orientação anterior</p>
            <p className="mt-1 text-sm">
              “{p.orientacao_anterior.orientacao}”
              <span className="text-muted"> — feedback de {periodo(p.orientacao_anterior)}</span>
            </p>
            <div className="mt-3">
              <RadioCards<Aplicacao>
                legend="Ele colocou essa orientação em prática?"
                columns={3}
                value={f.orientacao_anterior_aplicada}
                onChange={(x) => setF({ ...f, orientacao_anterior_aplicada: x })}
                options={(Object.keys(APLICACAO) as Aplicacao[]).map((k) => ({ value: k, label: APLICACAO[k] }))}
              />
            </div>
          </div>
        ) : null}

        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          {ITENS_FEEDBACK.map((it) => (
            <div key={it.key} className="border-b border-border pb-6 last:border-0">
              <p className="mb-2 font-bold">{it.label}</p>
              <ScalePicker legend={it.label} value={f[it.key].nota} onChange={(n) => setF({ ...f, [it.key]: { ...f[it.key], nota: n } })} />
              <Textarea
                className="mt-3"
                label="Justificativa"
                rows={2}
                value={f[it.key].justificativa}
                onChange={(e) => setF({ ...f, [it.key]: { ...f[it.key], justificativa: e.target.value } })}
              />
            </div>
          ))}
          <Textarea
            label="Orientação para o próximo período"
            hint="Linguagem simples, uma ação prática. No próximo feedback você vai dizer se ele aplicou."
            value={f.orientacao}
            onChange={(e) => setF({ ...f, orientacao: e.target.value })}
          />
          <details className="text-sm text-muted">
            <summary className="cursor-pointer font-semibold">Escala de referência</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {ESCALA.map((e) => (
                <li key={e.nota}>
                  <b className="text-text">
                    ({e.nota}) {e.titulo}
                  </b>{" "}
                  — {e.descricao}
                </li>
              ))}
            </ul>
          </details>
          {erro ? <Alert>{erro}</Alert> : null}
          <div className="flex gap-3">
            <Button type="submit" loading={m.isPending}>
              {existente ? "Salvar feedback" : "Enviar feedback"}
            </Button>
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- ver (e editar)

export function FeedbackPage() {
  return (
    <OnlyFor papel={["gestor", "representante"]}>
      <Ver />
    </OnlyFor>
  );
}

function Ver() {
  const { id = "" } = useParams();
  const u = useUser();
  const q = useQuery(feedbackQuery(id));
  const [editando, setEditando] = useState(false);
  if (q.isPending) return <PageLoading />;
  if (q.error) return <QueryError error={q.error} />;
  const f = q.data;
  const gestor = u.papel === "gestor";

  return (
    <>
      <PageHeader
        eyebrow={`Feedback de ${periodo(f)}`}
        title={gestor ? f.representante_nome : "Feedback do gestor"}
        subtitle={`Por ${f.gestor_nome}, atualizado em ${formatData(f.atualizado_em)}.`}
        actions={
          gestor && !editando ? (
            <>
              <Link to={`/visitas?representante_id=${f.representante_id}`} className={buttonClasses("outline", "sm")}>
                Visitas dele
              </Link>
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                Editar
              </Button>
            </>
          ) : null
        }
      />
      <div className="flex max-w-4xl flex-col gap-6">
        {editando ? (
          <FeedbackEditor
            key={f.atualizado_em}
            representanteId={f.representante_id}
            deInicial={diaISO(f.de)}
            ateInicial={diaISO(f.ate)}
            existente={f}
            onCancel={() => setEditando(false)}
          />
        ) : (
          <Card>
            <div className="flex flex-col gap-4">
              {ITENS_FEEDBACK.map((it) => {
                const nota = f[`nota_${it.key}`];
                const just = f[`just_${it.key}`];
                return (
                  <div key={it.key} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{it.label}</span>
                      <NotaBadge nota={nota} />
                    </div>
                    {just ? <p className="text-sm text-muted">{just}</p> : null}
                  </div>
                );
              })}
              {f.orientacao_anterior_aplicada ? (
                <p className="text-sm">
                  <span className="font-semibold">Colocou em prática a orientação anterior?</span> {APLICACAO[f.orientacao_anterior_aplicada]}
                </p>
              ) : null}
              {f.orientacao ? (
                <div className="rounded-field bg-brand-soft p-4">
                  <p className="text-xs font-bold text-brand uppercase">Orientação para o próximo período</p>
                  <p className="mt-1">{f.orientacao}</p>
                </div>
              ) : null}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
