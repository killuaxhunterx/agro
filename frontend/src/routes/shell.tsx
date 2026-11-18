import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";

import type { Papel, SessionUser } from "#app/@types/api";
import { DictationProvider } from "#app/components/ui/dictation";
import { PageLoading } from "#app/components/ui/spinner";
import { ApiError } from "#app/services/api/client";
import { sair, sessionQuery, transcrever } from "#app/services/api";
import { PAPEL, cx } from "#app/utils/format";

const UserContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const u = useContext(UserContext);
  if (!u) throw new Error("useUser fora de RequireAuth");
  return u;
}

type NavItem = { to: string; label: string; icon: string; end?: boolean; curto?: string };

const NAV: Record<Papel, NavItem[]> = {
  representante: [
    { to: "/", label: "Hoje", icon: "☀", end: true },
    { to: "/clientes", label: "Clientes", icon: "🏡" },
    { to: "/visitas", label: "Visitas", icon: "🚜" },
    { to: "/pendencias", label: "Pendências", icon: "✓" },
    { to: "/feedbacks", label: "Feedback", icon: "💬" },
    { to: "/painel", label: "Painel do representante", curto: "Painel", icon: "📊" },
  ],
  gestor: [
    { to: "/painel", label: "Painel do gestor", curto: "Painel", icon: "📊" },
    { to: "/feedbacks", label: "Feedback", icon: "💬" },
    { to: "/visitas", label: "Visitas", icon: "🚜" },
    { to: "/clientes", label: "Clientes", icon: "🏡" },
    { to: "/pendencias", label: "Pendências", icon: "✓" },
  ],
  master: [{ to: "/empresas", label: "Empresas", icon: "🏭" }],
};

export function RequireAuth() {
  const location = useLocation();
  const session = useQuery(sessionQuery);
  if (session.isPending) return <PageLoading />;
  if (session.error) {
    if (session.error instanceof ApiError && session.error.status === 401) {
      return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
    }
    return (
      <div className="p-8 text-center">
        <p className="font-bold">Não foi possível carregar.</p>
        <p className="text-sm text-muted">{session.error.message}</p>
      </div>
    );
  }
  const { user, transcricao_disponivel } = session.data;
  return (
    <UserContext value={user}>
      <DictationProvider transcribe={transcricao_disponivel ? transcrever : null}>
        <Shell user={user}>
          <Outlet />
        </Shell>
      </DictationProvider>
    </UserContext>
  );
}

function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: sair,
    onSettled: () => {
      qc.clear();
      void navigate("/entrar", { replace: true });
    },
  });
  const items = NAV[user.papel];

  return (
    <div className="min-h-dvh overflow-x-clip pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Marca />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-brand max-sm:hidden">Gestão de Campo</span>
              <span className="block text-[11px] text-muted max-sm:hidden">e Feedback Comercial</span>
            </span>
          </NavLink>
          <nav aria-label="Principal" className="hidden flex-1 gap-1 sm:flex">
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end ?? false}
                className={({ isActive }) =>
                  cx(
                    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-brand-soft text-brand" : "text-muted hover:text-text",
                  )
                }
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3 sm:ml-0">
            <NavLink to="/conta" className="min-w-0 text-right leading-tight">
              <span className="block truncate text-sm font-semibold">{user.nome}</span>
              <span className="block truncate text-[11px] text-muted max-sm:hidden">
                {PAPEL[user.papel]}
                {user.empresa_nome ? ` · ${user.empresa_nome}` : ""}
              </span>
            </NavLink>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-muted hover:bg-bg hover:text-text"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>

      {/* No celular, a navegação vai para baixo — onde o dedão alcança. */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface sm:hidden"
      >
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end ?? false}
            className={({ isActive }) =>
              cx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold",
                isActive ? "text-brand" : "text-muted",
              )
            }
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {i.icon}
            </span>
            {i.curto ?? i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Marca provisória até a logo oficial chegar. */
export function Marca({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--color-brand)" />
      <path d="M32 50V26" stroke="#f3e9d8" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 34c-9 0-14-6-14-14 9 0 14 6 14 14zM32 30c0-8 5-14 14-14 0 8-5 14-14 14z" fill="var(--color-field-green-light)" />
    </svg>
  );
}

/** Só o papel indicado vê o conteúdo; os outros voltam ao início. */
export function OnlyFor({ papel, children }: { papel: Papel | Papel[]; children: React.ReactNode }) {
  const u = useUser();
  const ok = Array.isArray(papel) ? papel.includes(u.papel) : u.papel === papel;
  return ok ? <>{children}</> : <Navigate to="/" replace />;
}
