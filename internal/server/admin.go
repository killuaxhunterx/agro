package server

import (
	"net/http"
	"time"

	"github.com/knowrisk/agro/internal/admin"
	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

// usuarioBody is a user as the master sees it — never the senha_hash.
type usuarioBody struct {
	ID       string    `json:"id"`
	Nome     string    `json:"nome"`
	Email    string    `json:"email"`
	Papel    string    `json:"papel"`
	Ativo    bool      `json:"ativo"`
	CriadoEm time.Time `json:"criado_em"`
}

func newUsuarioBody(u sqlc.User) usuarioBody {
	return usuarioBody{ID: u.ID.String(), Nome: u.Nome, Email: u.Email, Papel: u.Papel, Ativo: u.Ativo, CriadoEm: u.CriadoEm}
}

func (s *Server) ListEmpresas(w http.ResponseWriter, r *http.Request) {
	es, err := s.admin.ListEmpresas(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, es)
}

func (s *Server) CreateEmpresa(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nome                 string `json:"nome"`
		LimiteRepresentantes int    `json:"limite_representantes"`
	}
	if !decode(w, r, &body) {
		return
	}
	e, err := s.admin.CreateEmpresa(r.Context(), body.Nome, body.LimiteRepresentantes)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "empresa criada", "actor_id", user(r).ID, "empresa_id", e.ID)
	respondJSON(w, http.StatusCreated, e)
}

func (s *Server) GetEmpresa(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	e, err := s.admin.Empresa(r.Context(), id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	us, err := s.admin.ListUsers(r.Context(), id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	body := struct {
		sqlc.Empresa
		Usuarios []usuarioBody `json:"usuarios"`
	}{Empresa: e, Usuarios: make([]usuarioBody, 0, len(us))}
	for _, u := range us {
		body.Usuarios = append(body.Usuarios, newUsuarioBody(u))
	}
	respondJSON(w, http.StatusOK, body)
}

func (s *Server) SetLimite(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		LimiteRepresentantes int `json:"limite_representantes"`
	}
	if !decode(w, r, &body) {
		return
	}
	e, err := s.admin.SetLimite(r.Context(), id, body.LimiteRepresentantes)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "limite alterado", "actor_id", user(r).ID, "empresa_id", id, "limite", body.LimiteRepresentantes)
	respondJSON(w, http.StatusOK, e)
}

func (s *Server) CreateUsuario(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Nome  string `json:"nome"`
		Email string `json:"email"`
		Senha string `json:"senha"`
		Papel string `json:"papel"`
	}
	if !decode(w, r, &body) {
		return
	}
	papel := domain.Papel(body.Papel)
	if papel != domain.PapelGestor && papel != domain.PapelRepresentante {
		respondError(w, http.StatusUnprocessableEntity, "validation", "Escolha gestor ou representante.")
		return
	}
	u, err := s.admin.CreateUser(r.Context(), admin.NovoUsuario{EmpresaID: &id, Nome: body.Nome, Email: body.Email, Senha: body.Senha, Papel: papel})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "usuario criado", "actor_id", user(r).ID, "empresa_id", id, "user_id", u.ID, "papel", u.Papel)
	respondJSON(w, http.StatusCreated, newUsuarioBody(u))
}

func (s *Server) SetUsuarioAtivo(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	uid, ok := pathID(w, r, "uid")
	if !ok {
		return
	}
	var body struct {
		Ativo bool `json:"ativo"`
	}
	if !decode(w, r, &body) {
		return
	}
	u, err := s.admin.SetAtivo(r.Context(), id, uid, body.Ativo)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "usuario ativo alterado", "actor_id", user(r).ID, "user_id", uid, "ativo", body.Ativo)
	respondJSON(w, http.StatusOK, newUsuarioBody(u))
}
