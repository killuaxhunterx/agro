import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "#app/components/ui/button";
import { Input } from "#app/components/ui/field";
import { Alert, Card, PageHeader } from "#app/components/ui/layout";
import { toast } from "#app/components/ui/toast";
import { useUser } from "#app/routes/shell";
import { trocarSenha } from "#app/services/api";
import { PAPEL } from "#app/utils/format";

export function Conta() {
  const u = useUser();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const m = useMutation({
    mutationFn: () => trocarSenha(atual, nova),
    onSuccess: () => {
      setAtual("");
      setNova("");
      toast.success("Senha alterada.");
    },
  });
  return (
    <>
      <PageHeader eyebrow={PAPEL[u.papel]} title={u.nome} subtitle={u.email} />
      <Card className="max-w-md">
        <h2 className="mb-4 font-extrabold text-brand">Trocar senha</h2>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <Input label="Senha atual" type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
          <Input label="Nova senha" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." required value={nova} onChange={(e) => setNova(e.target.value)} />
          {m.error ? <Alert>{m.error.message}</Alert> : null}
          <Button type="submit" loading={m.isPending} className="self-start">
            Salvar
          </Button>
        </form>
      </Card>
    </>
  );
}
