import type { Aplicacao, ItemFeedbackKey, Motivo, Papel, Recurso, Situacao } from "#app/@types/api";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export const formatBRL = (centavos: number) => brl.format(centavos / 100);
export const formatBRLCompacto = (centavos: number) => brlCompacto.format(centavos / 100);
export const formatNumero = (n: number) => num.format(n);

/** "2026-11-10" ou "2026-11-10T00:00:00Z" → "10/11/2026". Datas de calendário, sem fuso. */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function formatMes(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  return `${meses[Number(m) - 1]}/${y?.slice(2)}`;
}

/** Hoje em "AAAA-MM-DD", no fuso de quem usa. */
export function hojeISO(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const diaISO = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/** "R$ 1.234,56" digitado → centavos. Aceita vírgula ou ponto decimal. */
export function parseReais(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const v = Number(normal);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export function parseQuantidade(texto: string): number | null {
  const v = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export const PAPEL: Record<Papel, string> = {
  master: "Consultoria",
  gestor: "Gestor",
  representante: "Representante",
};

export const SITUACAO: Record<Situacao, string> = {
  primeira_visita: "1ª visita no cliente",
  cliente: "Já é cliente",
};

export const MOTIVO: Record<Motivo, string> = {
  primeira_visita: "1ª visita no cliente",
  pos_venda: "Visita a cliente — pós-venda",
  acompanhamento: "Visita a cliente — acompanhamento",
  iniciativa_representante: "Reunião solicitada por minha iniciativa",
  convocada_cliente: "Reunião convocada pelo cliente",
  suporte_tecnico: "Suporte técnico / pendência de campo",
};

export const MOTIVO_CURTO: Record<Motivo, string> = {
  primeira_visita: "1ª visita",
  pos_venda: "Pós-venda",
  acompanhamento: "Acompanhamento",
  iniciativa_representante: "Minha iniciativa",
  convocada_cliente: "Convocada pelo cliente",
  suporte_tecnico: "Suporte técnico",
};

export const RECURSO: Record<Recurso, string> = {
  diaria: "Diária",
  folder: "Folder",
  amostra: "Amostra",
  combustivel: "Combustível",
  profissional_tecnico: "Profissional técnico (veterinário, agrônomo)",
  outro: "Outro",
};

export const ITENS_FEEDBACK: { key: ItemFeedbackKey; label: string }[] = [
  { key: "planejamento", label: "Planejamento" },
  { key: "resultados", label: "Resultados conseguidos" },
  { key: "aspectos_positivos", label: "Aspectos positivos da visita" },
  { key: "oportunidades", label: "Novas oportunidades" },
  { key: "pontos_melhorar", label: "Pontos a melhorar" },
  { key: "pendencias", label: "Pendências com cliente" },
];

export const ESCALA: { nota: number; titulo: string; descricao: string }[] = [
  { nota: 1, titulo: "Abaixo do esperado", descricao: "Atende parcialmente, com falhas relevantes" },
  { nota: 2, titulo: "Dentro do esperado", descricao: "Atende de forma consistente" },
  { nota: 3, titulo: "Acima do esperado", descricao: "Supera em diversos aspectos" },
  { nota: 4, titulo: "Excelência", descricao: "Performance de destaque, referência para outros" },
];

export const APLICACAO: Record<Aplicacao, string> = {
  sim: "Sim, colocou em prática",
  parcial: "Em parte",
  nao: "Não",
};

export function mediaLabel(m: number): string {
  if (!m) return "Sem avaliação";
  return `${m.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} / 4`;
}

/** "3ª visita neste cliente". */
export const ordinalVisita = (n: number) => `${n}ª visita neste cliente`;

/** Para a Identificação do cliente: deixa claro em que visita ele está. */
export const proximaVisita = (feitas: number) =>
  feitas === 0 ? "A próxima será a 1ª visita neste cliente" : `Já teve ${feitas} — a próxima será a ${feitas + 1}ª visita neste cliente`;
