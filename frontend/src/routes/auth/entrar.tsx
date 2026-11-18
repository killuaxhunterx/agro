import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "#app/components/ui/button";
import { Input } from "#app/components/ui/field";
import { Alert } from "#app/components/ui/layout";
import { entrar, keys } from "#app/services/api";

export function Entrar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const m = useMutation({
    mutationFn: () => entrar(email, senha),
    onSuccess: (s) => {
      qc.setQueryData(keys.session, s);
      const from = (location.state as { from?: string } | null)?.from;
      void navigate(from && from !== "/entrar" ? from : "/", { replace: true });
    },
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col bg-brand p-12 text-white lg:flex">
        <div>
          <img src="/logo-solucoes-az.png" alt="Anna Zaharov — Soluções de A a Z" className="h-28 w-auto" />
          <p className="mt-16 text-sm font-bold tracking-wider text-field-green-light uppercase">
            Gestão de Campo &amp; Feedback Comercial
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-extrabold">
            Menos distância entre a gestão e o campo.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Sistema para transformar Gestão Comercial em Resultados no Agronegócio.
          </p>
        </div>
        <p className="mt-auto text-sm text-white/60">Gestão próxima · Equipe eficiente · Resultados no agronegócio</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <form
          className="w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="mb-8 lg:hidden">
            <img src="/logo-solucoes-az.png" alt="Anna Zaharov — Soluções de A a Z" className="h-16 w-auto" />
          </div>
          <h2 className="text-2xl font-extrabold text-brand">Entrar</h2>
          <p className="mt-1 mb-6 text-sm text-muted">Use o e-mail e a senha que você recebeu.</p>
          <div className="flex flex-col gap-4">
            <Input label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            {m.error ? <Alert>{m.error.message}</Alert> : null}
            <Button type="submit" loading={m.isPending} className="mt-2 w-full">
              Entrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
