import { type QueryClient, queryOptions } from "@tanstack/react-query";

import type {
  Acao,
  AcaoInput,
  ClienteCompleto,
  ClienteInput,
  ClienteLista,
  Cliente,
  Empresa,
  EmpresaDetalhe,
  EmpresaLista,
  Feedback,
  FeedbackInput,
  FeedbackLista,
  FeedbackPeriodo,
  Opcoes,
  Painel,
  PainelFiltro,
  Papel,
  PlanejamentoInput,
  RealizacaoInput,
  Session,
  Usuario,
  Venda,
  VendaInput,
  Visita,
  VisitaCompleta,
  VisitaLista,
} from "#app/@types/api";
import { apiDelete, apiFetch, apiPost, apiPostFile, apiPut, qs } from "#app/services/api/client";

/** Chaves de cache por domínio. Uma escrita invalida o domínio inteiro — simples e correto. */
export const keys = {
  session: ["session"] as const,
  opcoes: ["opcoes"] as const,
  clientes: ["clientes"] as const,
  cliente: (id: string) => ["clientes", id] as const,
  visitas: (f: Record<string, string | undefined>) => ["visitas", f] as const,
  visita: (id: string) => ["visitas", id] as const,
  vendas: ["vendas"] as const,
  acoes: (abertas: boolean) => ["acoes", abertas] as const,
  feedbacks: (rep?: string) => ["feedbacks", rep ?? ""] as const,
  feedback: (id: string) => ["feedbacks", "um", id] as const,
  feedbackPeriodo: (f: Record<string, string | undefined>) => ["feedbacks", "periodo", f] as const,
  painel: (f: PainelFiltro) => ["painel", f] as const,
  empresas: ["empresas"] as const,
  empresa: (id: string) => ["empresas", id] as const,
};

/** Tudo que um registro de campo mexe: visita, venda e ação aparecem em várias telas. */
export function invalidateCampo(qc: QueryClient) {
  for (const k of ["clientes", "visitas", "vendas", "acoes", "painel", "opcoes", "feedbacks"]) {
    void qc.invalidateQueries({ queryKey: [k] });
  }
}

// ---------------------------------------------------------------- auth

export const sessionQuery = queryOptions({
  queryKey: keys.session,
  queryFn: () => apiFetch<Session>("/api/auth/sessao"),
  retry: false,
  staleTime: 5 * 60_000,
});

export const entrar = (email: string, senha: string) =>
  apiPost<Session>("/api/auth/entrar", { email, senha });
export const sair = () => apiPost<void>("/api/auth/sair");
export const trocarSenha = (atual: string, nova: string) =>
  apiPut<void>("/api/auth/senha", { atual, nova });

export async function transcrever(audio: Blob, duracaoSegundos: number): Promise<string> {
  const { texto } = await apiPostFile<{ texto: string }>(
    `/api/transcricoes?duracao_s=${duracaoSegundos}`,
    audio,
  );
  return texto;
}

// ---------------------------------------------------------------- campo

export const opcoesQuery = queryOptions({
  queryKey: keys.opcoes,
  queryFn: () => apiFetch<Opcoes>("/api/opcoes"),
  staleTime: 60_000,
});

export const clientesQuery = queryOptions({
  queryKey: keys.clientes,
  queryFn: () => apiFetch<ClienteLista[]>("/api/clientes"),
});

export const clienteQuery = (id: string) =>
  queryOptions({
    queryKey: keys.cliente(id),
    queryFn: () => apiFetch<ClienteCompleto>(`/api/clientes/${id}`),
  });

export const criarCliente = (b: ClienteInput) => apiPost<Cliente>("/api/clientes", b);
export const editarCliente = (id: string, b: ClienteInput) =>
  apiPut<Cliente>(`/api/clientes/${id}`, b);

export const visitasQuery = (f: { representante_id?: string; cliente_id?: string }) =>
  queryOptions({
    queryKey: keys.visitas(f),
    queryFn: () => apiFetch<VisitaLista[]>(`/api/visitas${qs(f)}`),
  });

export const visitaQuery = (id: string) =>
  queryOptions({
    queryKey: keys.visita(id),
    queryFn: () => apiFetch<VisitaCompleta>(`/api/visitas/${id}`),
  });

export const planejarVisita = (b: PlanejamentoInput) => apiPost<Visita>("/api/visitas", b);
export const editarPlanejamento = (id: string, b: PlanejamentoInput) =>
  apiPut<Visita>(`/api/visitas/${id}/planejamento`, b);
export const registrarRealizacao = (id: string, b: RealizacaoInput) =>
  apiPut<Visita>(`/api/visitas/${id}/realizacao`, b);

export const vendasQuery = queryOptions({
  queryKey: keys.vendas,
  queryFn: () => apiFetch<Venda[]>("/api/vendas"),
});
export const registrarVenda = (b: VendaInput) => apiPost<Venda>("/api/vendas", b);
export const removerVenda = (id: string) => apiDelete(`/api/vendas/${id}`);

export const acoesQuery = (abertas: boolean) =>
  queryOptions({
    queryKey: keys.acoes(abertas),
    queryFn: () => apiFetch<Acao[]>(`/api/acoes${qs({ abertas })}`),
  });
export const criarAcao = (visitaId: string, b: AcaoInput) =>
  apiPost<Acao>(`/api/visitas/${visitaId}/acoes`, b);
export const concluirAcao = (id: string, concluida: boolean) =>
  apiPut<Acao>(`/api/acoes/${id}/concluida`, { concluida });
export const removerAcao = (id: string) => apiDelete(`/api/acoes/${id}`);

// ---------------------------------------------------------------- feedback do gestor

export const feedbacksQuery = (representanteId?: string) =>
  queryOptions({
    queryKey: keys.feedbacks(representanteId),
    queryFn: () => apiFetch<FeedbackLista[]>(`/api/feedbacks${qs({ representante_id: representanteId })}`),
  });

export const feedbackQuery = (id: string) =>
  queryOptions({
    queryKey: keys.feedback(id),
    queryFn: () => apiFetch<Feedback>(`/api/feedbacks/${id}`),
  });

export const feedbackPeriodoQuery = (f: { representante_id: string; de: string; ate: string; excluir_id?: string }) =>
  queryOptions({
    queryKey: keys.feedbackPeriodo(f),
    queryFn: () => apiFetch<FeedbackPeriodo>(`/api/feedbacks/periodo${qs(f)}`),
    placeholderData: (prev) => prev,
  });

export const criarFeedback = (b: FeedbackInput) => apiPost<Feedback>("/api/feedbacks", b);
export const editarFeedback = (id: string, b: FeedbackInput) => apiPut<Feedback>(`/api/feedbacks/${id}`, b);

export const painelQuery = (f: PainelFiltro) =>
  queryOptions({
    queryKey: keys.painel(f),
    queryFn: () => apiFetch<Painel>(`/api/painel${qs(f)}`),
    placeholderData: (prev) => prev,
  });

// ---------------------------------------------------------------- master

export const empresasQuery = queryOptions({
  queryKey: keys.empresas,
  queryFn: () => apiFetch<EmpresaLista[]>("/api/admin/empresas"),
});
export const empresaQuery = (id: string) =>
  queryOptions({
    queryKey: keys.empresa(id),
    queryFn: () => apiFetch<EmpresaDetalhe>(`/api/admin/empresas/${id}`),
  });
export const criarEmpresa = (nome: string, limite_representantes: number) =>
  apiPost<Empresa>("/api/admin/empresas", { nome, limite_representantes });
export const alterarLimite = (id: string, limite_representantes: number) =>
  apiPut<Empresa>(`/api/admin/empresas/${id}/limite`, { limite_representantes });
export const criarUsuario = (
  empresaId: string,
  b: { nome: string; email: string; senha: string; papel: Exclude<Papel, "master"> },
) => apiPost<Usuario>(`/api/admin/empresas/${empresaId}/usuarios`, b);
export const alterarAtivo = (empresaId: string, uid: string, ativo: boolean) =>
  apiPut<Usuario>(`/api/admin/empresas/${empresaId}/usuarios/${uid}/ativo`, { ativo });
