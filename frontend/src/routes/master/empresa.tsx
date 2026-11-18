import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";

import type { EmpresaDetalhe } from "#app/@types/api";
import { Button } from "#app/components/ui/button";
import { Input, Select } from "#app/components/ui/field";
import { Alert, Card, PageHeader, SectionTitle, Tag } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { toast } from "#app/components/ui/toast";
import { QueryError } from "#app/routes/parts";
import { OnlyFor } from "#app/routes/shell";
import { alterarAtivo, alterarLimite, criarUsuario, empresaQuery, keys } from "#app/services/api";
import { PAPEL, formatData } from "#app/utils/format";

export function EmpresaPage() {
  return (
    <OnlyFor papel="master">
      <Inner />
    </OnlyFor>
  );
}

function Inner() {
  const { id = "" } = useParams();
  const q = useQuery(empresaQuery(id));
  if (q.isPending) return <PageLoading />;
  if (q.error) return <QueryError error={q.error} />;
  return <Detalhe e={q.data} />;
}

function Detalhe({ e }: { e: EmpresaDetalhe }) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.empresas });
  };
  const ativos = e.usuarios.filter((u) => u.papel === "representante" && u.ativo).length;

  const [limite, setLimite] = useState(String(e.limite_representantes));
  const ml = useMutation({
    mutationFn: () => alterarLimite(e.id, Number(limite)),
    onSuccess: () => {
      refresh();
      toast.success("Limite alterado.");
    },
    onError: (err) => toast.error(err.message),
  });

  const [nu, setNu] = useState({ nome: "", email: "", senha: "", papel: "representante" as "gestor" | "representante" });
  const mu = useMutation({
    mutationFn: () => criarUsuario(e.id, nu),
    onSuccess: (u) => {
      refresh();
      toast.success(`${u.nome} incluído. Passe o e-mail e a senha provisória para a pessoa.`);
      setNu({ nome: "", email: "", senha: "", papel: nu.papel });
    },
  });

  const ma = useMutation({
    mutationFn: (x: { uid: string; ativo: boolean }) => alterarAtivo(e.id, x.uid, x.ativo),
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Empresa"
        title={e.nome}
        subtitle={`Cliente desde ${formatData(e.criada_em)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <SectionTitle aside={<Tag tone={ativos >= e.limite_representantes ? "wheat" : "green"}>{ativos} de {e.limite_representantes} representantes</Tag>}>
            Usuários
          </SectionTitle>
          <ul className="flex flex-col divide-y divide-border">
            {e.usuarios.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className={u.ativo ? "block font-bold" : "block font-bold text-muted line-through"}>{u.nome}</span>
                  <span className="block text-xs text-muted">
                    {u.email} · {PAPEL[u.papel]}
                  </span>
                </span>
                <Button
                  size="xs"
                  variant={u.ativo ? "danger" : "outline"}
                  loading={ma.isPending && ma.variables?.uid === u.id}
                  onClick={() => ma.mutate({ uid: u.id, ativo: !u.ativo })}
                >
                  {u.ativo ? "Desativar" : "Reativar"}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Desativar encerra o acesso, mas o histórico de visitas e vendas fica com a empresa.
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-extrabold text-brand">Limite contratado</h2>
            <form
              className="flex items-end gap-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                ml.mutate();
              }}
            >
              <Input className="flex-1" label="Representantes" type="number" min={0} value={limite} onChange={(ev) => setLimite(ev.target.value)} />
              <Button type="submit" size="sm" loading={ml.isPending} className="mb-1">
                Salvar
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 font-extrabold text-brand">Incluir usuário</h2>
            <form
              className="flex flex-col gap-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                mu.mutate();
              }}
            >
              <Select label="Papel" value={nu.papel} onChange={(ev) => setNu({ ...nu, papel: ev.target.value as "gestor" | "representante" })}>
                <option value="representante">Representante</option>
                <option value="gestor">Gestor (dono ou gerente comercial)</option>
              </Select>
              <Input label="Nome completo" required value={nu.nome} onChange={(ev) => setNu({ ...nu, nome: ev.target.value })} />
              <Input label="E-mail" type="email" required value={nu.email} onChange={(ev) => setNu({ ...nu, email: ev.target.value })} />
              <Input label="Senha provisória" hint="Mínimo 8 caracteres. A pessoa troca depois em “Minha conta”." required value={nu.senha} onChange={(ev) => setNu({ ...nu, senha: ev.target.value })} />
              {mu.error ? <Alert>{mu.error.message}</Alert> : null}
              <Button type="submit" loading={mu.isPending}>
                Incluir
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
