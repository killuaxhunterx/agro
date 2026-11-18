// Package domain holds the pure types and rules of the product: papéis, the closed sets
// the forms offer (motivo da visita, recursos, situação do cliente) and the 1–4 scale of
// the feedback do gestor. It imports nothing from internal/.
package domain

import (
	"errors"
	"slices"

	"github.com/google/uuid"
)

// Papel is who the person is in the system.
type Papel string

const (
	// PapelMaster is the consultoria (us): creates empresas, users, and sets the contracted
	// limit of representantes. Belongs to no empresa.
	PapelMaster Papel = "master"
	// PapelGestor is the dono or the gerente comercial of an empresa: sees every
	// representante of that empresa and gives the feedback.
	PapelGestor Papel = "gestor"
	// PapelRepresentante fills the forms and sees only their own records.
	PapelRepresentante Papel = "representante"
)

func (p Papel) Valid() bool {
	return p == PapelMaster || p == PapelGestor || p == PapelRepresentante
}

// User is the signed-in person, as every handler sees it.
type User struct {
	ID          uuid.UUID
	EmpresaID   uuid.UUID // uuid.Nil for master
	EmpresaNome string
	Nome        string
	Email       string
	Papel       Papel
}

// Escopo is the read filter a user carries into every query of their empresa: a
// representante only ever reads their own rows, a gestor reads all of them. It is
// computed here, once, and never from a client parameter.
func (u User) Escopo() *uuid.UUID {
	if u.Papel == PapelRepresentante {
		id := u.ID
		return &id
	}
	return nil
}

// Situacao do cliente na identificação. "Prospect/lead" foi simplificado a pedido do Fernando.
var Situacoes = []string{"primeira_visita", "cliente"}

// Motivos da visita (planejamento), na ordem do formulário.
var Motivos = []string{
	"primeira_visita",
	"pos_venda",
	"acompanhamento",
	"iniciativa_representante",
	"convocada_cliente",
	"suporte_tecnico",
}

// Recursos necessários para a visita. "outro" pede o texto em recursos_obs.
var Recursos = []string{"diaria", "folder", "amostra", "combustivel", "profissional_tecnico", "outro"}

// Estados (UF) — a região do painel é o estado do cliente.
var Estados = []string{
	"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
	"PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}

// Aplicacao: a orientação anterior foi colocada em prática?
var Aplicacoes = []string{"sim", "parcial", "nao"}

// ValidNota is the escala de referência do feedback: 1 abaixo, 2 dentro, 3 acima,
// 4 excelência. Even on purpose — no middle option to hide in.
func ValidNota(n int) bool { return n >= 1 && n <= 4 }

// In reports whether v is one of the closed set.
func In(set []string, v string) bool { return slices.Contains(set, v) }

// Sentinels every service maps to an HTTP status in internal/server.
var (
	ErrNotFound    = errors.New("not found")
	ErrForbidden   = errors.New("forbidden")
	ErrLimite      = errors.New("limite de representantes atingido")
	ErrEmailEmUso  = errors.New("email em uso")
	ErrCredenciais = errors.New("credenciais inválidas")
)

// ValidationError carries the message the screen shows, in pt-BR.
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

// Invalid builds a ValidationError.
func Invalid(msg string) error { return &ValidationError{Msg: msg} }
