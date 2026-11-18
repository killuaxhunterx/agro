import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import type { Motivo, PlanejamentoInput, Recurso } from "#app/@types/api";
import { Button } from "#app/components/ui/button";
import { CheckboxGroup, RadioCards } from "#app/components/ui/choice";
import { Input, Select, Textarea } from "#app/components/ui/field";
import { Alert, Card, PageHeader, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { toast } from "#app/components/ui/toast";
import { OnlyFor } from "#app/routes/shell";
import { clientesQuery, editarPlanejamento, invalidateCampo, planejarVisita, visitaQuery } from "#app/services/api";
import { MOTIVO, RECURSO, diaISO, hojeISO, ordinalVisita } from "#app/utils/format";

const MOTIVOS = Object.keys(MOTIVO) as Motivo[];
const RECURSOS = Object.keys(RECURSO) as Recurso[];

export function VisitaPlanejar() {
  return (
    <OnlyFor papel="representante">
      <Inner />
    </OnlyFor>
  );
}

function Inner() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existente = useQuery({ ...visitaQuery(id ?? ""), enabled: Boolean(id) });
  if (id && existente.isPending) return <PageLoading />;
  const v = existente.data?.visita;
  const inicial: PlanejamentoInput = v
    ? {
        cliente_id: v.cliente_id,
        motivo: v.motivo,
        resultado_esperado: v.resultado_esperado,
        o_que: v.o_que,
        com_quem: v.com_quem,
        data: diaISO(v.data),
        horario: v.horario,
        recursos: v.recursos,
        recursos_obs: v.recursos_obs,
      }
    : {
        cliente_id: params.get("cliente") ?? "",
        motivo: "" as Motivo,
        resultado_esperado: "",
        o_que: "",
        com_quem: "",
        data: hojeISO(1),
        horario: "",
        recursos: [],
        recursos_obs: "",
      };
  return <Form id={id} inicial={inicial} numero={v?.numero_no_cliente} />;
}

function Form({ id, inicial, numero }: { id: string | undefined; inicial: PlanejamentoInput; numero: number | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clientes = useQuery(clientesQuery);
  const [f, setF] = useState(inicial);
  const set = <K extends keyof PlanejamentoInput>(k: K, v: PlanejamentoInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const m = useMutation({
    mutationFn: () => (id ? editarPlanejamento(id, f) : planejarVisita(f)),
    onSuccess: (v) => {
      invalidateCampo(qc);
      toast.success(id ? "Planejamento atualizado." : "Visita planejada.");
      void navigate(`/visitas/${v.id}`, { replace: true });
    },
  });

  const cliente = clientes.data?.find((c) => c.id === f.cliente_id);
  // Na edição o número já existe; numa visita nova ela entra depois das que o cliente já teve.
  const numeroVisita = numero ?? (cliente ? cliente.visitas_no_cliente + 1 : undefined);

  return (
    <>
      <PageHeader
        eyebrow="Planejamento"
        title={id ? "Editar planejamento" : "Planejar visita"}
        subtitle="O que vai fazer, com quem, quando e o que precisa levar. Leva dois minutos e evita a visita perdida."
      />
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Card>
          <SectionTitle n={1}>Identificação</SectionTitle>
          {id ? (
            <p className="font-bold">{cliente?.nome ?? "—"}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Select label="Para qual cliente?" required value={f.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
                <option value="">Escolha…</option>
                {(clientes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.cidade ? `${c.cidade}/` : ""}
                    {c.estado}
                  </option>
                ))}
              </Select>
              <Link to="/clientes/novo?voltar=visita" className="self-start text-sm font-bold text-brand hover:underline">
                + Cliente novo? Cadastre primeiro
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle n={2}>Planejamento</SectionTitle>
          {numeroVisita ? (
            <p className="mb-4 inline-block rounded-full bg-field-green-soft px-3 py-1 text-sm font-bold text-field-green-deep">
              {id ? "" : "Esta será a "}
              {ordinalVisita(numeroVisita)}
            </p>
          ) : null}
          <RadioCards<Motivo>
            legend="Motivo da visita"
            value={f.motivo || null}
            onChange={(v) => set("motivo", v)}
            options={MOTIVOS.map((k) => ({ value: k, label: MOTIVO[k] }))}
          />
        </Card>

        {/* O plano de ação começa pelo resultado: tudo o que vem depois é para alcançá-lo. */}
        <Card>
          <SectionTitle n={3}>Plano de ação</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea
              className="sm:col-span-2"
              label="Resultado que quer alcançar com esta visita"
              hint="Ex.: deixar amostra de sal mineral para teste; fechar o pedido do mês; levar o veterinário para avaliar o lote."
              value={f.resultado_esperado}
              onChange={(e) => set("resultado_esperado", e.target.value)}
            />
            <Textarea
              className="sm:col-span-2"
              label="O que vai fazer"
              rows={2}
              dictation={false}
              value={f.o_que}
              onChange={(e) => set("o_que", e.target.value)}
            />
            <Input className="sm:col-span-2" label="Com quem" placeholder="Nome e função de quem vai receber você" value={f.com_quem} onChange={(e) => set("com_quem", e.target.value)} />
            <Input label="Quando" type="date" required value={f.data} onChange={(e) => set("data", e.target.value)} />
            <Input label="Horário" type="time" value={f.horario} onChange={(e) => set("horario", e.target.value)} />
          </div>
          <div className="mt-5">
            <CheckboxGroup<Recurso>
              legend="Recursos necessários"
              value={f.recursos}
              onChange={(v) => set("recursos", v)}
              options={RECURSOS.map((k) => ({ value: k, label: RECURSO[k] }))}
            />
            {f.recursos.includes("profissional_tecnico") ? (
              <p className="mt-2 text-xs font-semibold text-field-green-deep">
                Avise o técnico com antecedência — o cliente vai estar esperando por ele.
              </p>
            ) : null}
            <Textarea
              className="mt-4"
              label="Detalhe dos recursos"
              hint="Quantas amostras, qual técnico, valor da diária ou do combustível…"
              rows={2}
              value={f.recursos_obs}
              onChange={(e) => set("recursos_obs", e.target.value)}
            />
          </div>
        </Card>

        {m.error ? <Alert>{m.error.message}</Alert> : null}
        <div className="flex gap-3">
          <Button type="submit" loading={m.isPending}>
            {id ? "Salvar planejamento" : "Planejar visita"}
          </Button>
          <Button variant="ghost" onClick={() => void navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}
