/** O envelope de erro de toda rota: `{"error": {"code", "message"}}`. */
type ErrorEnvelope = { error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A única porta para a API — componente nunca chama fetch. A sessão é um cookie HttpOnly;
 * nenhum token é legível pelo JS. Em dev o Vite repassa /api para o Go (mesma origem).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Sem conexão com o servidor. Verifique o sinal e tente de novo.",
    );
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function withBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  };
}

export const apiPost = <T>(path: string, body?: unknown) => apiFetch<T>(path, withBody("POST", body));
export const apiPut = <T>(path: string, body?: unknown) => apiFetch<T>(path, withBody("PUT", body));
export const apiDelete = (path: string) => apiFetch<void>(path, { method: "DELETE" });

export function apiPostFile<T>(path: string, file: Blob): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ErrorEnvelope>;
    if (body.error) return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    // Corpo que não é o nosso envelope (proxy, página HTML) cai na mensagem genérica.
  }
  return new ApiError(response.status, "unexpected_error", "Não foi possível falar com o servidor.");
}

/** Monta a query string, deixando de fora o que estiver vazio. */
export function qs(params: Record<string, string | undefined | null | boolean>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    sp.set(k, v === true ? "1" : v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
