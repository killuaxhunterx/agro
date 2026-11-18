import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import type { ClienteInput, Situacao } from "#app/@types/api";
import { Button, buttonClasses } from "#app/components/ui/button";
import { RadioCards } from "#app/components/ui/choice";
import { Input, Select } from "#app/components/ui/field";
import { Alert, Card, PageHeader, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { toast } from "#app/components/ui/toast";
import { OnlyFor } from "#app/routes/shell";
import { clienteQuery, clientesQuery, criarCliente, editarCliente, invalidateCampo, opcoesQuery } from "#app/services/api";
import { SITUACAO, cx, proximaVisita } from "#app/utils/format";

const VAZIO: ClienteInput = {
  situacao: "primeira_visita",
  nome: "",
  rua: "",
  numero: "",
  cidade: "",
  estado: "",
  cep: "",
  contato_nome: "",
  contato_email: "",
  contato_telefone: "",
  ramo: "",
};

export function ClienteForm() {
  return (
    <OnlyFor papel="representante">
      <ClienteFormInner />
    </OnlyFor>
  );
}

function ClienteFormInner() {
  const { id } = useParams();
  const existente = useQuery({
    ...clienteQuery(id ?? ""),
    enabled: Boolean(id),
  });
  if (id && existente.isPending) return <PageLoading />;
  const c = existente.data?.cliente;
  return <Formulario id={id} inicial={c ? { ...VAZIO, ...c } : VAZIO} visitas={c?.visitas_no_cliente ?? 0} />;
}

/** A máscara de telefone é só de exibição: o que é guardado é o que a pessoa vê. */
function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Para achar o mesmo cliente digitado de outro jeito: sem acento, caixa ou pontuação. */
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Cadastro = "cadastrado" | "nao_cadastrado";

function Formulario({ id, inicial, visitas }: { id: string | undefined; inicial: ClienteInput; visitas: number }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const opcoes = useQuery(opcoesQuery);
  const clientes = useQuery(clientesQuery);
  const [f, setF] = useState<ClienteInput>(inicial);
  const set = <K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) => setF((x) => ({ ...x, [k]: v }));
  // "Já é cliente" pode já estar no sistema: aí não se cadastra de novo, vai para a lista.
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [existenteId, setExistenteId] = useState("");
  const veioDaVisita = params.get("voltar") === "visita";
  const escolhendoExistente = !id && f.situacao === "cliente" && cadastro === "cadastrado";
  const precisaResponderCadastro = !id && f.situacao === "cliente" && cadastro === null;

  const nomeNorm = normalizar(f.nome);
  const repetido = nomeNorm ? clientes.data?.find((c) => c.id !== id && normalizar(c.nome) === nomeNorm) : undefined;

  const m = useMutation({
    mutationFn: () => (id ? editarCliente(id, f) : criarCliente(f)),
    onSuccess: (c) => {
      invalidateCampo(qc);
      toast.success(id ? "Cliente atualizado." : "Cliente cadastrado.");
      // Veio do planejamento de uma visita: volta para lá com o cliente escolhido.
      if (!id && veioDaVisita) void navigate(`/visitas/nova?cliente=${c.id}`, { replace: true });
      else void navigate(`/clientes/${c.id}`, { replace: true });
    },
  });

  return (
    <>
      <PageHeader eyebrow="Cadastro de cliente" title={id ? "Editar identificação" : "Identificação"} />
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Card>
          <RadioCards<Situacao>
            legend="Identificação"
            value={f.situacao}
            onChange={(v) => set("situacao", v)}
            options={[
              {
                value: "primeira_visita",
                label: SITUACAO.primeira_visita,
                hint: "Ainda não compra da empresa",
              },
              {
                value: "cliente",
                label: SITUACAO.cliente,
                hint: "Já comprou da empresa",
              },
            ]}
          />
          {/* Em que visita ele está: contado pelo sistema (ver README), ninguém marca. */}
          {id || f.situacao === "primeira_visita" || cadastro === "nao_cadastrado" ? (
            <p className="mt-4 rounded-full bg-field-green-soft px-3 py-1 text-sm font-bold text-field-green-deep sm:inline-block">
              {/* Já é cliente mas é novo no sistema: as visitas de antes ficaram fora dele. */}
              {!id && f.situacao === "cliente" ? "Ainda sem visita registrada no sistema" : proximaVisita(visitas)}
            </p>
          ) : null}
          {!id && f.situacao === "cliente" ? (
            <div className="mt-5 border-t border-border pt-5">
              <RadioCards<Cadastro>
                legend="Ele já está cadastrado no sistema?"
                value={cadastro}
                onChange={setCadastro}
                options={[
                  {
                    value: "cadastrado",
                    label: "Já cadastrado",
                    hint: "Escolha na lista",
                  },
                  {
                    value: "nao_cadastrado",
                    label: "Não cadastrado",
                    hint: "Preencha os dados abaixo",
                  },
                ]}
              />
            </div>
          ) : null}
        </Card>

        {escolhendoExistente ? (
          <Card>
            <SectionTitle>Clientes já cadastrados</SectionTitle>
            <Select label="Qual cliente?" value={existenteId} onChange={(e) => setExistenteId(e.target.value)}>
              <option value="">Escolha…</option>
              {(clientes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.cidade ? `${c.cidade}/` : ""}
                  {c.estado}
                </option>
              ))}
            </Select>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={existenteId ? `/visitas/nova?cliente=${existenteId}` : "#"}
                aria-disabled={!existenteId}
                className={cx(buttonClasses("primary"), !existenteId && "pointer-events-none opacity-50")}
              >
                Planejar visita para ele
              </Link>
              {existenteId ? (
                <Link to={`/clientes/${existenteId}`} className={buttonClasses("outline")}>
                  Ver ficha
                </Link>
              ) : null}
            </div>
            {clientes.data?.length === 0 ? <p className="mt-3 text-sm text-muted">Você ainda não tem cliente cadastrado. Marque “Não cadastrado”.</p> : null}
          </Card>
        ) : null}

        {escolhendoExistente || precisaResponderCadastro ? null : (
          <>
            <Card>
              <SectionTitle>Cliente</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-6">
                <Input
                  className="sm:col-span-6"
                  label="Nome completo da empresa / fazenda"
                  required
                  value={f.nome}
                  onChange={(e) => set("nome", e.target.value)}
                />
                <Input className="sm:col-span-4" label="Rua / estrada" value={f.rua} onChange={(e) => set("rua", e.target.value)} />
                <Input className="sm:col-span-2" label="Número" value={f.numero} onChange={(e) => set("numero", e.target.value)} />
                <Input className="sm:col-span-3" label="Cidade" value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
                <Select className="sm:col-span-1" label="Estado" required value={f.estado} onChange={(e) => set("estado", e.target.value)}>
                  <option value="">—</option>
                  {(opcoes.data?.estados ?? []).map((uf) => (
                    <option key={uf}>{uf}</option>
                  ))}
                </Select>
                <Input
                  className="sm:col-span-2"
                  label="CEP"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={f.cep}
                  onChange={(e) => set("cep", maskCEP(e.target.value))}
                />
              </div>
            </Card>

            <Card>
              <SectionTitle>Contato</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input className="sm:col-span-2" label="Nome completo" value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} />
                <Input
                  label="Telefone"
                  type="tel"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={f.contato_telefone}
                  onChange={(e) => set("contato_telefone", maskTelefone(e.target.value))}
                />
                <Input label="E-mail" type="email" value={f.contato_email} onChange={(e) => set("contato_email", e.target.value)} />
              </div>
            </Card>

            <Card>
              <SectionTitle>Caracterização</SectionTitle>
              <Input
                label="Atividade"
                hint="Ex.: café, bovinocultura de corte, pecuária leiteira, avicultura."
                list="ramos"
                value={f.ramo}
                onChange={(e) => set("ramo", e.target.value)}
              />
              <datalist id="ramos">
                {(opcoes.data?.ramos ?? []).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Card>

            {repetido ? (
              <Alert>
                Já existe um cliente com esse nome:{" "}
                <Link to={`/clientes/${repetido.id}`} className="underline">
                  {repetido.nome}
                </Link>
                . Confira se não é o mesmo antes de cadastrar.
              </Alert>
            ) : null}
            {m.error ? <Alert>{m.error.message}</Alert> : null}
            <div className="flex gap-3">
              <Button type="submit" loading={m.isPending}>
                {id ? "Salvar" : "Cadastrar cliente"}
              </Button>
              <Button variant="ghost" onClick={() => void navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </form>
    </>
  );
}
