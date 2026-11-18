import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";

import type { AcaoInput, RealizacaoInput, VisitaCompleta } from "#app/@types/api";
import { Button, buttonClasses } from "#app/components/ui/button";
import { Input, Textarea } from "#app/components/ui/field";
import { Alert, Card, Dado, Empty, PageHeader, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { toast } from "#app/components/ui/toast";
import { AcaoItem, QueryError, StatusVisita } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { VendaForm, VendasTabela, useRemoverVenda } from "#app/routes/vendas";
import { criarAcao, invalidateCampo, registrarRealizacao, visitaQuery } from "#app/services/api";
import { MOTIVO, RECURSO, SITUACAO, diaISO, formatData, hojeISO, ordinalVisita } from "#app/utils/format";

export function VisitaDetalhe() {
  const { id = "" } = useParams();
  const u = useUser();
  const q = useQuery(visitaQuery(id));
  if (q.isPending) return <PageLoading />;
  if (q.error) return <QueryError error={q.error} />;

  const d = q.data;
  const v = d.visita;
  const souRep = u.papel === "representante";

  return (
    <>
      <PageHeader
        eyebrow={`${formatData(v.data)}${v.horario ? ` · ${v.horario}` : ""} · ${v.cliente_estado}`}
        title={v.cliente_nome}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusVisita v={v} />
            {!souRep ? <span>Representante: {v.representante_nome}</span> : null}
          </span>
        }
        actions={
          <Link to={`/clientes/${v.cliente_id}`} className={buttonClasses("outline", "sm")}>
            Ficha do cliente
          </Link>
        }
      />

      <div className="flex max-w-4xl flex-col gap-6">
        <Identificacao d={d} />
        <Planejamento d={d} souRep={souRep} />
        <PlanoDeAcao d={d} />
        <Realizacao d={d} souRep={souRep} key={`r-${v.realizada_em ?? ""}`} />
        <Vendas d={d} souRep={souRep} />
        <Acompanhamento d={d} souRep={souRep} />
        <FeedbackDoPeriodo d={d} gestor={u.papel === "gestor"} />
      </div>
    </>
  );
}

function Identificacao({ d }: { d: VisitaCompleta }) {
  const v = d.visita;
  return (
    <Card>
      <SectionTitle n={1}>Identificação</SectionTitle>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dado label="Cliente">{v.cliente_nome}</Dado>
        <Dado label="Situação">{SITUACAO[v.cliente_situacao]}</Dado>
        <Dado label="Estado">{v.cliente_estado}</Dado>
      </dl>
    </Card>
  );
}

function EditarPlanejamento({ id }: { id: string }) {
  return (
    <Link to={`/visitas/${id}/planejamento`} className="text-sm font-bold text-brand hover:underline">
      Editar
    </Link>
  );
}

function Planejamento({ d, souRep }: { d: VisitaCompleta; souRep: boolean }) {
  const v = d.visita;
  return (
    <Card>
      <SectionTitle n={2} aside={souRep ? <EditarPlanejamento id={v.id} /> : null}>
        Planejamento
      </SectionTitle>
      <dl>
        <Dado label="Visita">{ordinalVisita(v.numero_no_cliente)}</Dado>
        <Dado label="Motivo da visita">{MOTIVO[v.motivo]}</Dado>
      </dl>
    </Card>
  );
}

/** O resultado vem primeiro e junto: tudo o que ele vai fazer é para alcançá-lo. */
function PlanoDeAcao({ d }: { d: VisitaCompleta }) {
  const v = d.visita;
  return (
    <Card>
      <SectionTitle n={3}>Plano de ação</SectionTitle>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Dado label="Resultado que quer alcançar">{v.resultado_esperado}</Dado>
        </div>
        <div className="sm:col-span-2">
          <Dado label="O que vai fazer">{v.o_que}</Dado>
        </div>
        <Dado label="Com quem">{v.com_quem}</Dado>
        <Dado label="Quando">
          {formatData(v.data)}
          {v.horario ? ` · ${v.horario}` : ""}
        </Dado>
        <Dado label="Recursos necessários">{v.recursos.map((r) => RECURSO[r]).join(", ")}</Dado>
        <Dado label="Detalhe dos recursos">{v.recursos_obs}</Dado>
      </dl>
    </Card>
  );
}

const CAMPOS_REALIZACAO: { key: keyof RealizacaoInput; label: string; hint?: string }[] = [
  { key: "resultados", label: "Resultados conseguidos", hint: "O que você conseguiu? Mesmo numa 1ª visita: despertou interesse, ele pediu proposta…" },
  { key: "aspectos_positivos", label: "Aspectos positivos da visita" },
  { key: "oportunidades", label: "Outras oportunidades de negócio identificadas" },
  { key: "pendencias", label: "Pendências com o cliente", hint: "O que você precisa enviar ou resolver. Cadastre cada uma no acompanhamento, com prazo." },
  { key: "pontos_melhorar", label: "Pontos a melhorar" },
];

function Realizacao({ d, souRep }: { d: VisitaCompleta; souRep: boolean }) {
  const qc = useQueryClient();
  const v = d.visita;
  const realizada = Boolean(v.realizada_em);
  const [editando, setEditando] = useState(!realizada);
  const [f, setF] = useState<RealizacaoInput>({
    resultados: v.resultados,
    aspectos_positivos: v.aspectos_positivos,
    oportunidades: v.oportunidades,
    pendencias: v.pendencias,
    pontos_melhorar: v.pontos_melhorar,
  });
  const m = useMutation({
    mutationFn: () => registrarRealizacao(v.id, f),
    onSuccess: () => {
      invalidateCampo(qc);
      toast.success("Visita registrada.");
      setEditando(false);
    },
  });

  if (!souRep || (realizada && !editando)) {
    return (
      <Card>
        <SectionTitle
          n={4}
          aside={
            souRep ? (
              <button type="button" onClick={() => setEditando(true)} className="text-sm font-bold text-brand hover:underline">
                Editar
              </button>
            ) : null
          }
        >
          Realização
        </SectionTitle>
        {realizada ? (
          <dl className="flex flex-col gap-4">
            {CAMPOS_REALIZACAO.map((c) => (
              <Dado key={c.key} label={c.label}>
                {v[c.key]}
              </Dado>
            ))}
          </dl>
        ) : (
          <Empty title="Ainda não registrada.">O representante conta aqui como foi a visita.</Empty>
        )}
      </Card>
    );
  }

  const futura = diaISO(v.data) > hojeISO();
  return (
    <Card>
      <SectionTitle n={4}>Realização — como foi?</SectionTitle>
      {futura ? (
        <p className="mb-4 text-sm text-muted">A visita está marcada para {formatData(v.data)}. Registre depois de ir.</p>
      ) : (
        <p className="mb-4 text-sm text-muted">Toque em “Falar” e conte. Não precisa escrever.</p>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {CAMPOS_REALIZACAO.map((c) => (
          <Textarea
            key={c.key}
            label={c.label}
            hint={c.hint}
            required={c.key === "resultados"}
            value={f[c.key]}
            onChange={(e) => setF((x) => ({ ...x, [c.key]: e.target.value }))}
          />
        ))}
        {m.error ? <Alert>{m.error.message}</Alert> : null}
        <div className="flex gap-3">
          <Button type="submit" loading={m.isPending}>
            {realizada ? "Salvar" : "Registrar visita"}
          </Button>
          {realizada ? (
            <Button variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function Vendas({ d, souRep }: { d: VisitaCompleta; souRep: boolean }) {
  const [aberto, setAberto] = useState(false);
  const remover = useRemoverVenda();
  const v = d.visita;
  return (
    <Card>
      <SectionTitle
        n={5}
        aside={
          souRep && !aberto ? (
            <Button size="sm" variant="green" onClick={() => setAberto(true)}>
              + Registrar venda
            </Button>
          ) : null
        }
      >
        O que foi vendido nesta visita
      </SectionTitle>
      {aberto ? (
        <div className="mb-5">
          <VendaForm clienteId={v.cliente_id} visitaId={v.id} dataPadrao={diaISO(v.data)} onDone={() => setAberto(false)} />
        </div>
      ) : null}
      <VendasTabela
        vendas={d.vendas}
        {...(souRep ? { onRemove: (x) => window.confirm(`Remover a venda de ${x.produto}?`) && remover.mutate(x) } : {})}
      />
    </Card>
  );
}

function Acompanhamento({ d, souRep }: { d: VisitaCompleta; souRep: boolean }) {
  const qc = useQueryClient();
  // Sem nenhum próximo passo ainda, o plano de ação já aparece aberto — sem clique a mais.
  const [aberto, setAberto] = useState(souRep && d.acoes.length === 0);
  const vazio: AcaoInput = { resultado: "", o_que: "", como: "", com_quem: "", prazo: hojeISO(7) };
  const [f, setF] = useState<AcaoInput>(vazio);
  const m = useMutation({
    mutationFn: () => criarAcao(d.visita.id, f),
    onSuccess: () => {
      invalidateCampo(qc);
      toast.success("Próximo passo registrado.");
      setF(vazio);
      setAberto(false);
    },
  });
  return (
    <Card>
      <SectionTitle
        n={6}
        aside={
          souRep && !aberto ? (
            <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
              + Próximo passo
            </Button>
          ) : null
        }
      >
        Acompanhamento
      </SectionTitle>
      {aberto ? (
        <form
          className="mb-5 flex flex-col gap-4 rounded-field border border-border bg-bg/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <Textarea label="Resultado que quer alcançar" rows={2} value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })} />
          <Textarea label="O que vai fazer" rows={2} required value={f.o_que} onChange={(e) => setF({ ...f, o_que: e.target.value })} />
          <Textarea label="Como vai fazer" rows={2} value={f.como} onChange={(e) => setF({ ...f, como: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Com quem precisa alinhar" value={f.com_quem} onChange={(e) => setF({ ...f, com_quem: e.target.value })} />
            <Input label="Até quando" type="date" required value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
          </div>
          {m.error ? <Alert>{m.error.message}</Alert> : null}
          <div className="flex gap-3">
            <Button type="submit" loading={m.isPending}>
              Salvar próximo passo
            </Button>
            {d.acoes.length > 0 ? (
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      {d.acoes.length === 0 ? (
        aberto ? null : <Empty title="Nenhum próximo passo registrado." />
      ) : (
        <ul className="flex flex-col gap-2">
          {d.acoes.map((a) => (
            <AcaoItem key={a.id} a={a} canEdit={souRep} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** O feedback é por período, não por visita: aqui só aparece o que cobre esta data. */
function FeedbackDoPeriodo({ d, gestor }: { d: VisitaCompleta; gestor: boolean }) {
  const v = d.visita;
  const f = d.feedback;
  return (
    <Card>
      <SectionTitle n={7}>Feedback do gestor</SectionTitle>
      {f ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Esta visita entrou no feedback de {formatData(f.de)} a {formatData(f.ate)}, dado por {f.gestor_nome}.
          </p>
          <Link to={`/feedbacks/${f.id}`} className={buttonClasses("outline", "sm")}>
            Ver feedback
          </Link>
        </div>
      ) : (
        <Empty title="Ainda sem feedback para este período.">
          {gestor ? (
            <>
              O feedback não é visita por visita: junte o que {v.representante_nome} fez no período e avalie de uma vez.{" "}
              <Link to={`/feedbacks/novo?representante_id=${v.representante_id}`} className="font-bold text-brand hover:underline">
                Dar feedback
              </Link>
            </>
          ) : (
            "O gestor avalia o conjunto das suas visitas de um período. Quando ele avaliar, o feedback aparece aqui."
          )}
        </Empty>
      )}
    </Card>
  );
}
