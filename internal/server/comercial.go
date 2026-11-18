package server

import (
	"net/http"
	"time"

	"github.com/knowrisk/agro/internal/comercial"
	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

// The sqlc rows carry snake_case json tags and no secret column, so they go out as they are.

func (s *Server) Opcoes(w http.ResponseWriter, r *http.Request) {
	o, err := s.comercial.Opcoes(r.Context(), user(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	reps := o.Representantes
	if reps == nil {
		reps = []sqlc.ListRepresentantesRow{}
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"representantes": reps,
		"ramos":          nonNil(o.Ramos),
		"produtos":       nonNil(o.Produtos),
		"estados":        domain.Estados,
	})
}

func nonNil[T any](v []T) []T {
	if v == nil {
		return []T{}
	}
	return v
}

// ---------------------------------------------------------------- clientes

func (s *Server) ListClientes(w http.ResponseWriter, r *http.Request) {
	cs, err := s.comercial.ListClientes(r.Context(), user(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, nonNil(cs))
}

func (s *Server) GetCliente(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	u := user(r)
	c, err := s.comercial.Cliente(r.Context(), u, id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	visitas, err := s.comercial.ListVisitas(r.Context(), u, comercial.VisitaFiltro{ClienteID: &id})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	vendas, err := s.comercial.ListVendas(r.Context(), u, &id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"cliente": c, "visitas": nonNil(visitas), "vendas": nonNil(vendas)})
}

func (s *Server) CreateCliente(w http.ResponseWriter, r *http.Request) {
	var in comercial.ClienteInput
	if !decode(w, r, &in) {
		return
	}
	c, err := s.comercial.CreateCliente(r.Context(), user(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, c)
}

func (s *Server) UpdateCliente(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in comercial.ClienteInput
	if !decode(w, r, &in) {
		return
	}
	c, err := s.comercial.UpdateCliente(r.Context(), user(r), id, in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, c)
}

// ---------------------------------------------------------------- visitas

func (s *Server) ListVisitas(w http.ResponseWriter, r *http.Request) {
	vs, err := s.comercial.ListVisitas(r.Context(), user(r), comercial.VisitaFiltro{
		RepresentanteID: queryID(r, "representante_id"), ClienteID: queryID(r, "cliente_id"),
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, nonNil(vs))
}

func (s *Server) GetVisita(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	d, err := s.comercial.Visita(r.Context(), user(r), id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"visita": d.Visita, "vendas": nonNil(d.Vendas), "acoes": nonNil(d.Acoes), "feedback": d.Feedback,
	})
}

func (s *Server) CreateVisita(w http.ResponseWriter, r *http.Request) {
	var in comercial.PlanejamentoInput
	if !decode(w, r, &in) {
		return
	}
	v, err := s.comercial.CreateVisita(r.Context(), user(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, v)
}

func (s *Server) UpdatePlanejamento(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in comercial.PlanejamentoInput
	if !decode(w, r, &in) {
		return
	}
	v, err := s.comercial.UpdatePlanejamento(r.Context(), user(r), id, in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, v)
}

func (s *Server) Realizar(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in comercial.RealizacaoInput
	if !decode(w, r, &in) {
		return
	}
	v, err := s.comercial.Realizar(r.Context(), user(r), id, in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, v)
}

// ---------------------------------------------------------------- vendas

func (s *Server) ListVendas(w http.ResponseWriter, r *http.Request) {
	vs, err := s.comercial.ListVendas(r.Context(), user(r), queryID(r, "cliente_id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, nonNil(vs))
}

func (s *Server) CreateVenda(w http.ResponseWriter, r *http.Request) {
	var in comercial.VendaInput
	if !decode(w, r, &in) {
		return
	}
	v, err := s.comercial.CreateVenda(r.Context(), user(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, v)
}

func (s *Server) DeleteVenda(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := s.comercial.DeleteVenda(r.Context(), user(r), id); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------- acompanhamento

func (s *Server) ListAcoes(w http.ResponseWriter, r *http.Request) {
	as, err := s.comercial.ListAcoes(r.Context(), user(r), r.URL.Query().Get("abertas") == "1")
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, nonNil(as))
}

func (s *Server) CreateAcao(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in comercial.AcaoInput
	if !decode(w, r, &in) {
		return
	}
	a, err := s.comercial.CreateAcao(r.Context(), user(r), id, in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, a)
}

func (s *Server) SetAcaoConcluida(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Concluida bool `json:"concluida"`
	}
	if !decode(w, r, &body) {
		return
	}
	a, err := s.comercial.SetAcaoConcluida(r.Context(), user(r), id, body.Concluida)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, a)
}

func (s *Server) DeleteAcao(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := s.comercial.DeleteAcao(r.Context(), user(r), id); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------- feedback do gestor

func (s *Server) ListFeedbacks(w http.ResponseWriter, r *http.Request) {
	fs, err := s.comercial.ListFeedbacks(r.Context(), user(r), queryID(r, "representante_id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, nonNil(fs))
}

func (s *Server) GetFeedback(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	f, err := s.comercial.Feedback(r.Context(), user(r), id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, f)
}

// PeriodoFeedback is what the gestor reads before giving the feedback of one period.
func (s *Server) PeriodoFeedback(w http.ResponseWriter, r *http.Request) {
	rep := queryID(r, "representante_id")
	if rep == nil {
		respondError(w, http.StatusUnprocessableEntity, "validation", "Escolha o representante.")
		return
	}
	de, err1 := time.Parse("2006-01-02", r.URL.Query().Get("de"))
	ate, err2 := time.Parse("2006-01-02", r.URL.Query().Get("ate"))
	if err1 != nil || err2 != nil {
		respondError(w, http.StatusUnprocessableEntity, "validation", "Informe o período.")
		return
	}
	p, err := s.comercial.PeriodoFeedback(r.Context(), user(r), *rep, de, ate, queryID(r, "excluir_id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"representante": p.Representante, "visitas": nonNil(p.Visitas), "vendas": nonNil(p.Vendas),
		"acoes": nonNil(p.Acoes), "orientacao_anterior": p.OrientacaoAnterior,
	})
}

func (s *Server) CriarFeedback(w http.ResponseWriter, r *http.Request) {
	var in comercial.FeedbackInput
	if !decode(w, r, &in) {
		return
	}
	f, err := s.comercial.CriarFeedback(r.Context(), user(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "feedback criado", "actor_id", user(r).ID, "feedback_id", f.ID)
	respondJSON(w, http.StatusCreated, f)
}

func (s *Server) AtualizarFeedback(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in comercial.FeedbackInput
	if !decode(w, r, &in) {
		return
	}
	f, err := s.comercial.AtualizarFeedback(r.Context(), user(r), id, in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.logger.InfoContext(r.Context(), "feedback atualizado", "actor_id", user(r).ID, "feedback_id", id)
	respondJSON(w, http.StatusOK, f)
}

// ---------------------------------------------------------------- painel

func (s *Server) Painel(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	hoje := time.Now()
	ate, err := time.Parse("2006-01-02", q.Get("ate"))
	if err != nil {
		ate = time.Date(hoje.Year(), hoje.Month(), hoje.Day(), 0, 0, 0, 0, time.UTC)
	}
	de, err := time.Parse("2006-01-02", q.Get("de"))
	if err != nil {
		// Padrão: os últimos 12 meses, a partir do dia 1.
		de = time.Date(ate.Year(), ate.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -11, 0)
	}
	if de.After(ate) {
		respondError(w, http.StatusUnprocessableEntity, "validation", "A data inicial é depois da final.")
		return
	}
	p, err := s.comercial.Painel(r.Context(), user(r), comercial.PainelFiltro{
		RepresentanteID: queryID(r, "representante_id"), Estado: queryText(r, "estado"),
		Produto: queryText(r, "produto"), ClienteID: queryID(r, "cliente_id"), Ramo: queryText(r, "ramo"),
		De: de, Ate: ate,
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"de": de.Format("2006-01-02"), "ate": ate.Format("2006-01-02"),
		"mensal": nonNil(p.Mensal), "por_representante": nonNil(p.PorRepresentante),
		"por_estado": nonNil(p.PorEstado), "por_produto": nonNil(p.PorProduto), "por_cliente": nonNil(p.PorCliente),
		"visitas": p.Visitas, "acoes": p.Acoes, "equipe": nonNil(p.Equipe),
		"sem_compra": nonNil(p.SemCompra), "dias_sem_compra": p.DiasSemCompra,
	})
}
