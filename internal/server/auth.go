package server

import (
	"errors"
	"math"
	"net/http"
	"strconv"

	"github.com/knowrisk/agro/internal/auth"
	"github.com/knowrisk/agro/internal/domain"
)

type userBody struct {
	ID          string `json:"id"`
	Nome        string `json:"nome"`
	Email       string `json:"email"`
	Papel       string `json:"papel"`
	EmpresaID   string `json:"empresa_id,omitempty"`
	EmpresaNome string `json:"empresa_nome,omitempty"`
}

type sessionBody struct {
	User                  userBody `json:"user"`
	TranscricaoDisponivel bool     `json:"transcricao_disponivel"`
}

func (s *Server) sessionBody(u domain.User) sessionBody {
	b := userBody{ID: u.ID.String(), Nome: u.Nome, Email: u.Email, Papel: string(u.Papel), EmpresaNome: u.EmpresaNome}
	if u.Papel != domain.PapelMaster {
		b.EmpresaID = u.EmpresaID.String()
	}
	return sessionBody{User: b, TranscricaoDisponivel: s.cfg.Transcritor != nil}
}

func (s *Server) setCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookieName, Value: token, Path: "/", MaxAge: maxAge,
		HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) SignIn(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.loginLimiter.permitir(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retry.Seconds()))))
		respondError(w, http.StatusTooManyRequests, "too_many_requests", "Muitas tentativas. Espere um minuto e tente de novo.")
		return
	}
	var body struct {
		Email string `json:"email"`
		Senha string `json:"senha"`
	}
	if !decode(w, r, &body) {
		return
	}
	token, u, err := s.auth.SignIn(r.Context(), body.Email, body.Senha)
	if errors.Is(err, domain.ErrCredenciais) {
		respondError(w, http.StatusUnauthorized, "credenciais_invalidas", "E-mail ou senha incorretos.")
		return
	}
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.setCookie(w, token, int(auth.SessionTTL.Seconds()))
	s.logger.InfoContext(r.Context(), "sign in", "actor_id", u.ID, "papel", u.Papel)
	respondJSON(w, http.StatusOK, s.sessionBody(u))
}

func (s *Server) SignOut(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookieName); err == nil {
		if err := s.auth.SignOut(r.Context(), c.Value); err != nil {
			s.logger.ErrorContext(r.Context(), "sign out", "error", err)
		}
	}
	s.setCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) Session(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, s.sessionBody(user(r)))
}

func (s *Server) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Atual string `json:"atual"`
		Nova  string `json:"nova"`
	}
	if !decode(w, r, &body) {
		return
	}
	if err := s.auth.ChangePassword(r.Context(), user(r).ID, body.Atual, body.Nova); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
