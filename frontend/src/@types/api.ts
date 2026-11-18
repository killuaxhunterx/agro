/** Espelha o JSON da API Go (tags snake_case do sqlc). Datas chegam como ISO 8601. */

export type Papel = "master" | "gestor" | "representante";

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  empresa_id?: string;
  empresa_nome?: string;
};

export type Session = { user: SessionUser; transcricao_disponivel: boolean };

export type Situacao = "primeira_visita" | "cliente";

export type Motivo =
  | "primeira_visita"
  | "pos_venda"
  | "acompanhamento"
  | "iniciativa_representante"
  | "convocada_cliente"
  | "suporte_tecnico";

export type Recurso =
  | "diaria"
  | "folder"
  | "amostra"
  | "combustivel"
  | "profissional_tecnico"
  | "outro";

export type Cliente = {
  id: string;
  empresa_id: string;
  representante_id: string;
  situacao: Situacao;
  nome: string;
  rua: string;
  numero: string;
  cidade: string;
  estado: string;
  cep: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  ramo: string;
  criado_em: string;
};

export type ClienteLista = Cliente & {
  representante_nome: string;
  ultima_compra: string | null;
  ultima_visita: string | null;
  total_vendido_centavos: number;
  /** Visitas da empresa a este cliente que contam para a numeração; a próxima é esta + 1. */
  visitas_no_cliente: number;
};

export type ClienteInput = Omit<Cliente, "id" | "empresa_id" | "representante_id" | "criado_em">;

export type Visita = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  representante_id: string;
  motivo: Motivo;
  resultado_esperado: string;
  o_que: string;
  com_quem: string;
  data: string;
  horario: string;
  recursos: Recurso[];
  recursos_obs: string;
  realizada_em: string | null;
  resultados: string;
  aspectos_positivos: string;
  oportunidades: string;
  pendencias: string;
  pontos_melhorar: string;
  criada_em: string;
};

export type VisitaDetalhe = Visita & {
  cliente_nome: string;
  cliente_estado: string;
  cliente_situacao: Situacao;
  representante_nome: string;
  /** 1ª, 2ª, 3ª… visita da empresa a este cliente, em ordem de data. */
  numero_no_cliente: number;
};

export type VisitaLista = {
  id: string;
  cliente_id: string;
  representante_id: string;
  motivo: Motivo;
  data: string;
  horario: string;
  o_que: string;
  realizada_em: string | null;
  cliente_nome: string;
  cliente_estado: string;
  representante_nome: string;
  acoes_abertas: number;
};

export type PlanejamentoInput = {
  cliente_id: string;
  motivo: Motivo;
  resultado_esperado: string;
  o_que: string;
  com_quem: string;
  data: string;
  horario: string;
  recursos: Recurso[];
  recursos_obs: string;
};

export type RealizacaoInput = {
  resultados: string;
  aspectos_positivos: string;
  oportunidades: string;
  pendencias: string;
  pontos_melhorar: string;
};

export type Venda = {
  id: string;
  cliente_id: string;
  representante_id: string;
  visita_id: string | null;
  data: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valor_unitario_centavos: number;
  valor_total_centavos: number;
  observacoes: string;
  cliente_nome: string;
  representante_nome: string;
};

export type VendaInput = {
  cliente_id: string;
  visita_id: string | null;
  data: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valor_unitario_centavos: number;
  observacoes: string;
};

export type Acao = {
  id: string;
  visita_id: string;
  representante_id: string;
  resultado: string;
  o_que: string;
  como: string;
  com_quem: string;
  prazo: string | null;
  concluida_em: string | null;
  criada_em: string;
  cliente_nome: string;
  cliente_id: string;
  representante_nome: string;
};

export type AcaoInput = {
  resultado: string;
  o_que: string;
  como: string;
  com_quem: string;
  prazo: string;
};

export type ItemFeedbackKey =
  | "planejamento"
  | "resultados"
  | "aspectos_positivos"
  | "oportunidades"
  | "pontos_melhorar"
  | "pendencias";

export type Aplicacao = "sim" | "parcial" | "nao";

type NotasFeedback = {
  nota_planejamento: number;
  just_planejamento: string;
  nota_resultados: number;
  just_resultados: string;
  nota_aspectos_positivos: number;
  just_aspectos_positivos: string;
  nota_oportunidades: number;
  just_oportunidades: string;
  nota_pontos_melhorar: number;
  just_pontos_melhorar: string;
  nota_pendencias: number;
  just_pendencias: string;
};

/** Feedback do gestor: um por representante e período, não por visita. */
export type Feedback = NotasFeedback & {
  id: string;
  representante_id: string;
  representante_nome: string;
  gestor_id: string;
  gestor_nome: string;
  de: string;
  ate: string;
  orientacao: string;
  orientacao_anterior_aplicada: Aplicacao | null;
  atualizado_em: string;
};

export type FeedbackLista = Omit<Feedback, keyof NotasFeedback> & { media: number };

export type FeedbackInput = Record<ItemFeedbackKey, { nota: number; justificativa: string }> & {
  representante_id: string;
  de: string;
  ate: string;
  orientacao: string;
  orientacao_anterior_aplicada: Aplicacao | null;
};

/** Tudo o que o representante fez no período — o gestor lê antes de avaliar. */
export type FeedbackPeriodo = {
  representante: { id: string; nome: string; email: string; ativo: boolean };
  visitas: VisitaLista[];
  vendas: Venda[];
  acoes: Acao[];
  orientacao_anterior: { id: string; orientacao: string; de: string; ate: string } | null;
};

export type VisitaCompleta = {
  visita: VisitaDetalhe;
  vendas: Venda[];
  acoes: Acao[];
  /** O feedback cujo período cobre a data da visita, se já houver. */
  feedback: { id: string; de: string; ate: string; gestor_nome: string } | null;
};

export type ClienteCompleto = {
  cliente: Cliente & { representante_nome: string; visitas_no_cliente: number };
  visitas: VisitaLista[];
  vendas: Venda[];
};

export type Opcoes = {
  representantes: { id: string; nome: string; email: string; ativo: boolean }[];
  ramos: string[];
  produtos: string[];
  estados: string[];
};

export type PainelFiltro = {
  representante_id?: string;
  estado?: string;
  produto?: string;
  cliente_id?: string;
  ramo?: string;
  de?: string;
  ate?: string;
};

type Soma = { total_centavos: number; vendas: number };

export type Painel = {
  de: string;
  ate: string;
  mensal: ({ mes: string } & Soma)[];
  por_representante: ({ id: string; nome: string } & Soma)[];
  por_estado: ({ estado: string; representantes: number } & Soma)[];
  por_produto: ({ produto: string } & Soma)[];
  por_cliente: ({ id: string; nome: string; estado: string } & Soma)[];
  visitas: {
    realizadas: number;
    planejadas: number;
    sem_registro: number;
    primeiras_visitas: number;
  };
  acoes: { abertas: number; atrasadas: number };
  equipe: {
    id: string;
    nome: string;
    visitas_realizadas: number;
    vendido_centavos: number;
    acoes_abertas: number;
    acoes_atrasadas: number;
    media_feedback: number;
    ultimo_feedback: string | null;
  }[];
  sem_compra: {
    id: string;
    nome: string;
    estado: string;
    representante_nome: string;
    ultima_compra: string;
    total_centavos: number;
  }[];
  dias_sem_compra: number;
};

export type Empresa = {
  id: string;
  nome: string;
  limite_representantes: number;
  criada_em: string;
};

export type EmpresaLista = Empresa & { representantes_ativos: number; gestores_ativos: number };

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
};

export type EmpresaDetalhe = Empresa & { usuarios: Usuario[] };
