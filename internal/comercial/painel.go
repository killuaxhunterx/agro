package comercial

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

// PainelFiltro is the combination the gestor picks on the painel. A nil field is "todos".
type PainelFiltro struct {
	RepresentanteID *uuid.UUID
	Estado          *string
	Produto         *string
	ClienteID       *uuid.UUID
	Ramo            *string
	De, Ate         time.Time
}

// diasSemCompra is when a cliente that used to buy shows up in the alert.
const diasSemCompra = 60

type Painel struct {
	Filtro           PainelFiltro
	Mensal           []sqlc.PainelVendasMensalRow
	PorRepresentante []sqlc.PainelVendasPorRepresentanteRow
	PorEstado        []sqlc.PainelVendasPorEstadoRow
	PorProduto       []sqlc.PainelVendasPorProdutoRow
	PorCliente       []sqlc.PainelVendasPorClienteRow
	Visitas          sqlc.PainelVisitasRow
	Acoes            sqlc.PainelAcoesRow
	Equipe           []sqlc.PainelPorRepresentanteRow
	SemCompra        []sqlc.PainelClientesSemCompraRow
	DiasSemCompra    int
}

// Painel builds every chart for one filter. A representante's filter is forced to
// themselves, whatever was asked.
func (s *Service) Painel(ctx context.Context, u domain.User, f PainelFiltro) (Painel, error) {
	if u.Papel == domain.PapelMaster {
		return Painel{}, domain.ErrForbidden
	}
	if esc := u.Escopo(); esc != nil {
		f.RepresentanteID = esc
	}
	p := Painel{Filtro: f, DiasSemCompra: diasSemCompra}
	e := u.EmpresaID
	var err error

	if p.Mensal, err = s.q.PainelVendasMensal(ctx, sqlc.PainelVendasMensalParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		ClienteID: f.ClienteID, Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.PorRepresentante, err = s.q.PainelVendasPorRepresentante(ctx, sqlc.PainelVendasPorRepresentanteParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		ClienteID: f.ClienteID, Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.PorEstado, err = s.q.PainelVendasPorEstado(ctx, sqlc.PainelVendasPorEstadoParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		ClienteID: f.ClienteID, Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.PorProduto, err = s.q.PainelVendasPorProduto(ctx, sqlc.PainelVendasPorProdutoParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		ClienteID: f.ClienteID, Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.PorCliente, err = s.q.PainelVendasPorCliente(ctx, sqlc.PainelVendasPorClienteParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		ClienteID: f.ClienteID, Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.Visitas, err = s.q.PainelVisitas(ctx, sqlc.PainelVisitasParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, ClienteID: f.ClienteID,
		Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	if p.Acoes, err = s.q.PainelAcoes(ctx, sqlc.PainelAcoesParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, ClienteID: f.ClienteID,
		Ramo: f.Ramo}); err != nil {
		return p, err
	}
	if p.Equipe, err = s.q.PainelPorRepresentante(ctx, sqlc.PainelPorRepresentanteParams{
		EmpresaID: &e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Produto: f.Produto,
		Ramo: f.Ramo, De: f.De, Ate: f.Ate}); err != nil {
		return p, err
	}
	p.SemCompra, err = s.q.PainelClientesSemCompra(ctx, sqlc.PainelClientesSemCompraParams{
		EmpresaID: e, RepresentanteID: f.RepresentanteID, Estado: f.Estado, Ramo: f.Ramo, Dias: diasSemCompra})
	return p, err
}
