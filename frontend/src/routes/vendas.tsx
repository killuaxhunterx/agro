import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Venda } from "#app/@types/api";
import { Button } from "#app/components/ui/button";
import { Input, Textarea } from "#app/components/ui/field";
import { Alert, Empty } from "#app/components/ui/layout";
import { toast } from "#app/components/ui/toast";
import { invalidateCampo, opcoesQuery, registrarVenda, removerVenda } from "#app/services/api";
import { formatBRL, formatData, formatNumero, hojeISO, parseQuantidade, parseReais } from "#app/utils/format";

/** Mostra na horizontal, como tabela. No celular a tabela rola de lado dentro do cartão. */
export function VendasTabela({ vendas, onRemove }: { vendas: Venda[]; onRemove?: (v: Venda) => void }) {
  if (vendas.length === 0) return <Empty title="Nenhuma venda registrada." />;
  const total = vendas.reduce((s, v) => s + v.valor_total_centavos, 0);
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 pl-5 font-semibold sm:pl-0">Data</th>
            <th className="py-2 pr-3 font-semibold">Produto</th>
            <th className="py-2 pr-3 text-right font-semibold">Quantidade</th>
            <th className="py-2 pr-3 font-semibold">Unidade</th>
            <th className="py-2 pr-3 text-right font-semibold">Valor unitário</th>
            <th className="py-2 pr-3 text-right font-semibold">Valor total</th>
            <th className="py-2 pr-5 font-semibold sm:pr-0">Observações</th>
            {onRemove ? <th className="sr-only">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {vendas.map((v) => (
            <tr key={v.id} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3 pl-5 whitespace-nowrap tabular-nums sm:pl-0">{formatData(v.data)}</td>
              <td className="py-2.5 pr-3 font-semibold">{v.produto}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumero(v.quantidade)}</td>
              <td className="py-2.5 pr-3 text-muted">{v.unidade}</td>
              <td className="py-2.5 pr-3 text-right whitespace-nowrap tabular-nums">{formatBRL(v.valor_unitario_centavos)}</td>
              <td className="py-2.5 pr-3 text-right font-bold whitespace-nowrap tabular-nums">{formatBRL(v.valor_total_centavos)}</td>
              <td className="py-2.5 pr-5 text-muted sm:pr-0">{v.observacoes}</td>
              {onRemove ? (
                <td className="py-2.5 pr-5 text-right sm:pr-0">
                  <button type="button" onClick={() => onRemove(v)} className="text-xs font-bold text-danger hover:underline">
                    Remover
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="pt-3 pl-5 text-right text-xs font-semibold text-muted sm:pl-0">
              Total
            </td>
            <td className="pt-3 pr-3 text-right font-extrabold whitespace-nowrap tabular-nums">{formatBRL(total)}</td>
            <td colSpan={onRemove ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Preenche na vertical: um item por vez, campo embaixo de campo. */
export function VendaForm({
  clienteId,
  visitaId,
  dataPadrao,
  onDone,
}: {
  clienteId: string;
  visitaId: string | null;
  dataPadrao?: string;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const opcoes = useQuery(opcoesQuery);
  const [data, setData] = useState(dataPadrao ?? hojeISO());
  const [produto, setProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const qtd = parseQuantidade(quantidade);
  const unit = parseReais(valor);
  const total = qtd !== null && unit !== null ? Math.round(qtd * unit) : null;

  const m = useMutation({
    mutationFn: () => {
      if (qtd === null) throw new Error("Informe a quantidade vendida.");
      if (unit === null) throw new Error("Informe o valor unitário em reais.");
      return registrarVenda({
        cliente_id: clienteId,
        visita_id: visitaId,
        data,
        produto,
        quantidade: qtd,
        unidade,
        valor_unitario_centavos: unit,
        observacoes: obs,
      });
    },
    onSuccess: () => {
      invalidateCampo(qc);
      toast.success("Venda registrada.");
      setProduto("");
      setQuantidade("");
      setValor("");
      setObs("");
      setErro(null);
      onDone?.();
    },
    onError: (e) => setErro(e.message),
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-field border border-border bg-bg/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        <Input label="Produto" required list="produtos" value={produto} onChange={(e) => setProduto(e.target.value)} />
        <datalist id="produtos">
          {(opcoes.data?.produtos ?? []).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Input label="Quantidade vendida" inputMode="decimal" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <Input label="Unidade de medida" hint="Ex.: saco 40 kg, tonelada, litro" required value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        <Input label="Valor unitário (R$)" inputMode="decimal" placeholder="0,00" required value={valor} onChange={(e) => setValor(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Valor total (R$)</span>
          <span className="rounded-field border-[1.5px] border-dashed border-border-strong bg-surface px-4 py-3 font-bold tabular-nums">
            {total === null ? "—" : formatBRL(total)}
          </span>
        </div>
      </div>
      <Textarea label="Observações" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      {erro ? <Alert>{erro}</Alert> : null}
      <div className="flex gap-3">
        <Button type="submit" variant="green" loading={m.isPending}>
          Registrar venda
        </Button>
        {onDone ? (
          <Button variant="ghost" onClick={onDone}>
            Fechar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function useRemoverVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Venda) => removerVenda(v.id),
    onSuccess: () => {
      invalidateCampo(qc);
      toast.success("Venda removida.");
    },
    onError: (e) => toast.error(e.message),
  });
}
