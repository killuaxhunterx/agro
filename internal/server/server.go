// Package server is the HTTP layer: routes, middleware, JSON in and out. It never touches
// SQL — every read and write goes through a service in internal/.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/knowrisk/agro/internal/admin"
	"github.com/knowrisk/agro/internal/auth"
	"github.com/knowrisk/agro/internal/comercial"
	"github.com/knowrisk/agro/internal/domain"
)

type Config struct {
	// CookieSecure marks the session cookie Secure. Only false to reach the dev server over
	// plain http from another device on the LAN.
	CookieSecure bool
	// StaticDir, when set, is the built frontend (frontend/dist) served at / with an SPA
	// fallback — one process is enough for a demo deploy.
	StaticDir   string
	Transcritor Transcritor
}

type Server struct {
	auth      *auth.Service
	admin     *admin.Service
	comercial *comercial.Service
	logger    *slog.Logger
	cfg       Config

	loginLimiter *limiter
	transcricoes *limiter
}

func New(a *auth.Service, ad *admin.Service, c *comercial.Service, logger *slog.Logger, cfg Config) *Server {
	return &Server{
		auth: a, admin: ad, comercial: c, logger: logger, cfg: cfg,
		loginLimiter: newLimiter(10, minute),
		transcricoes: newLimiter(transcricoesPorHora, hour),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/auth/entrar", s.SignIn)
	mux.HandleFunc("POST /api/auth/sair", s.SignOut)

	signed := func(h http.HandlerFunc) http.Handler { return s.requireUser(h) }
	only := func(p domain.Papel, h http.HandlerFunc) http.Handler { return s.requireUser(s.requirePapel(p, h)) }
	inEmpresa := func(h http.HandlerFunc) http.Handler {
		return s.requireUser(s.requirePapel("", h))
	}

	mux.Handle("GET /api/auth/sessao", signed(s.Session))
	mux.Handle("PUT /api/auth/senha", signed(s.ChangePassword))
	mux.Handle("POST /api/transcricoes", signed(s.Transcrever))

	// Master
	mux.Handle("GET /api/admin/empresas", only(domain.PapelMaster, s.ListEmpresas))
	mux.Handle("POST /api/admin/empresas", only(domain.PapelMaster, s.CreateEmpresa))
	mux.Handle("GET /api/admin/empresas/{id}", only(domain.PapelMaster, s.GetEmpresa))
	mux.Handle("PUT /api/admin/empresas/{id}/limite", only(domain.PapelMaster, s.SetLimite))
	mux.Handle("POST /api/admin/empresas/{id}/usuarios", only(domain.PapelMaster, s.CreateUsuario))
	mux.Handle("PUT /api/admin/empresas/{id}/usuarios/{uid}/ativo", only(domain.PapelMaster, s.SetUsuarioAtivo))

	// Empresa: gestor e representante. Cada serviço decide quem escreve o quê.
	mux.Handle("GET /api/opcoes", inEmpresa(s.Opcoes))
	mux.Handle("GET /api/clientes", inEmpresa(s.ListClientes))
	mux.Handle("POST /api/clientes", inEmpresa(s.CreateCliente))
	mux.Handle("GET /api/clientes/{id}", inEmpresa(s.GetCliente))
	mux.Handle("PUT /api/clientes/{id}", inEmpresa(s.UpdateCliente))
	mux.Handle("GET /api/visitas", inEmpresa(s.ListVisitas))
	mux.Handle("POST /api/visitas", inEmpresa(s.CreateVisita))
	mux.Handle("GET /api/visitas/{id}", inEmpresa(s.GetVisita))
	mux.Handle("PUT /api/visitas/{id}/planejamento", inEmpresa(s.UpdatePlanejamento))
	mux.Handle("PUT /api/visitas/{id}/realizacao", inEmpresa(s.Realizar))
	mux.Handle("POST /api/visitas/{id}/acoes", inEmpresa(s.CreateAcao))
	mux.Handle("GET /api/feedbacks", inEmpresa(s.ListFeedbacks))
	mux.Handle("GET /api/feedbacks/periodo", inEmpresa(s.PeriodoFeedback))
	mux.Handle("POST /api/feedbacks", inEmpresa(s.CriarFeedback))
	mux.Handle("GET /api/feedbacks/{id}", inEmpresa(s.GetFeedback))
	mux.Handle("PUT /api/feedbacks/{id}", inEmpresa(s.AtualizarFeedback))
	mux.Handle("GET /api/vendas", inEmpresa(s.ListVendas))
	mux.Handle("POST /api/vendas", inEmpresa(s.CreateVenda))
	mux.Handle("DELETE /api/vendas/{id}", inEmpresa(s.DeleteVenda))
	mux.Handle("GET /api/acoes", inEmpresa(s.ListAcoes))
	mux.Handle("PUT /api/acoes/{id}/concluida", inEmpresa(s.SetAcaoConcluida))
	mux.Handle("DELETE /api/acoes/{id}", inEmpresa(s.DeleteAcao))
	mux.Handle("GET /api/painel", inEmpresa(s.Painel))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		respondError(w, http.StatusNotFound, "not_found", "Rota não encontrada.")
	})
	if s.cfg.StaticDir != "" {
		mux.Handle("/", spa(s.cfg.StaticDir))
	}

	return s.recoverer(securityHeaders(mux))
}

// ---------------------------------------------------------------- middleware

type ctxKey struct{}

func UserFrom(ctx context.Context) (domain.User, bool) {
	u, ok := ctx.Value(ctxKey{}).(domain.User)
	return u, ok
}

func user(r *http.Request) domain.User {
	u, _ := UserFrom(r.Context())
	return u
}

const sessionCookieName = "agro_session"

func (s *Server) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		c, err := r.Cookie(sessionCookieName)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "unauthorized", "Entre de novo para continuar.")
			return
		}
		u, err := s.auth.UserBySession(r.Context(), c.Value)
		if err != nil {
			if !errors.Is(err, domain.ErrCredenciais) {
				s.logger.ErrorContext(r.Context(), "resolve session", "error", err)
			}
			respondError(w, http.StatusUnauthorized, "unauthorized", "Entre de novo para continuar.")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	})
}

// requirePapel gates a route to one papel. The empty papel means "anyone inside an
// empresa" — gestor or representante, never master.
func (s *Server) requirePapel(p domain.Papel, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := user(r)
		ok := u.Papel == p || (p == "" && u.Papel != domain.PapelMaster)
		if !ok {
			respondError(w, http.StatusForbidden, "forbidden", "Você não tem acesso a esta área.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("Permissions-Policy", "microphone=(self), camera=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.logger.ErrorContext(r.Context(), "panic", "panic", v, "path", r.URL.Path)
				respondError(w, http.StatusInternalServerError, "internal", "Erro inesperado. Tente de novo.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// spa serves the built frontend; any path that is not a file falls back to index.html so
// the client router owns it.
func spa(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(dir, filepath.Clean("/"+r.URL.Path))
		if st, err := os.Stat(p); err != nil || st.IsDir() {
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, filepath.Join(dir, "index.html"))
			return
		}
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------- JSON

type errorEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func respondJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, code, msg string) {
	var e errorEnvelope
	e.Error.Code, e.Error.Message = code, msg
	respondJSON(w, status, e)
}

const maxBodyBytes = 128 << 10

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		respondError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Envie JSON.")
		return false
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Não foi possível ler os dados enviados.")
		return false
	}
	return true
}

// fail maps a service error to its HTTP answer. Anything unknown is a 500, logged.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	var ve *domain.ValidationError
	switch {
	case errors.As(err, &ve):
		respondError(w, http.StatusUnprocessableEntity, "validation", ve.Msg)
	case errors.Is(err, domain.ErrNotFound):
		respondError(w, http.StatusNotFound, "not_found", "Registro não encontrado.")
	case errors.Is(err, domain.ErrForbidden):
		respondError(w, http.StatusForbidden, "forbidden", "Você não pode fazer isso.")
	case errors.Is(err, domain.ErrLimite):
		respondError(w, http.StatusConflict, "limite_representantes",
			"A empresa atingiu o limite de representantes contratado. Aumente o limite antes de incluir mais um.")
	case errors.Is(err, domain.ErrEmailEmUso):
		respondError(w, http.StatusConflict, "email_em_uso", "Já existe uma conta com esse e-mail.")
	default:
		s.logger.ErrorContext(r.Context(), "request failed", "path", r.URL.Path, "method", r.Method, "error", err)
		respondError(w, http.StatusInternalServerError, "internal", "Erro inesperado. Tente de novo.")
	}
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(r.PathValue(name))
	if err != nil {
		respondError(w, http.StatusNotFound, "not_found", "Registro não encontrado.")
		return uuid.Nil, false
	}
	return id, true
}

// queryID reads an optional uuid query parameter; a malformed one is treated as absent.
func queryID(r *http.Request, name string) *uuid.UUID {
	id, err := uuid.Parse(r.URL.Query().Get(name))
	if err != nil {
		return nil
	}
	return &id
}

func queryText(r *http.Request, name string) *string {
	v := strings.TrimSpace(r.URL.Query().Get(name))
	if v == "" {
		return nil
	}
	return &v
}
