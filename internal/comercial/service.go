// Package comercial owns the representante's records — clientes, visitas (planejamento e
// realização), vendas, acompanhamento — and the feedback do gestor, plus the painel built
// from them.
//
// The tenant and the representante filter both come from the signed-in domain.User,
// never from the request: every query takes u.EmpresaID, and every read takes u.Escopo().
// Writes to a representante's records always pin representante_id = u.ID, so a gestor
// cannot write in their name and one representante cannot write in another's.
package comercial

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

type Service struct {
	q *sqlc.Queries
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{q: sqlc.New(pool)}
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}

func requireRepresentante(u domain.User) error {
	if u.Papel != domain.PapelRepresentante {
		return domain.ErrForbidden
	}
	return nil
}

func requireGestor(u domain.User) error {
	if u.Papel != domain.PapelGestor {
		return domain.ErrForbidden
	}
	return nil
}

const dateLayout = "2006-01-02"

func parseDate(s, campo string) (time.Time, error) {
	t, err := time.Parse(dateLayout, strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, domain.Invalid(fmt.Sprintf("Informe %s.", campo))
	}
	return t, nil
}

func parseOptionalDate(s, campo string) (*time.Time, error) {
	if strings.TrimSpace(s) == "" {
		return nil, nil
	}
	t, err := parseDate(s, campo)
	return &t, err
}

const maxTexto = 4000

func clean(s string) string { return strings.TrimSpace(s) }

func checkLen(campos ...string) error {
	for _, c := range campos {
		if len([]rune(c)) > maxTexto {
			return domain.Invalid(fmt.Sprintf("Cada texto pode ter até %d caracteres.", maxTexto))
		}
	}
	return nil
}

// ---------------------------------------------------------------- Clientes (Identificação)

type ClienteInput struct {
	Situacao        string `json:"situacao"`
	Nome            string `json:"nome"`
	Rua             string `json:"rua"`
	Numero          string `json:"numero"`
	Cidade          string `json:"cidade"`
	Estado          string `json:"estado"`
	CEP             string `json:"cep"`
	ContatoNome     string `json:"contato_nome"`
	ContatoEmail    string `json:"contato_email"`
	ContatoTelefone string `json:"contato_telefone"`
	Ramo            string `json:"ramo"`
}

var cepRe = regexp.MustCompile(`^\d{5}-?\d{3}$`)

func (in *ClienteInput) normalize() error {
	in.Situacao, in.Nome, in.Rua, in.Numero = clean(in.Situacao), clean(in.Nome), clean(in.Rua), clean(in.Numero)
	in.Cidade, in.Estado, in.CEP = clean(in.Cidade), strings.ToUpper(clean(in.Estado)), clean(in.CEP)
	in.ContatoNome, in.ContatoEmail = clean(in.ContatoNome), strings.ToLower(clean(in.ContatoEmail))
	in.ContatoTelefone, in.Ramo = clean(in.ContatoTelefone), clean(in.Ramo)
	switch {
	case !domain.In(domain.Situacoes, in.Situacao):
		return domain.Invalid("Marque se é 1ª visita ou se já é cliente.")
	case in.Nome == "":
		return domain.Invalid("Informe o nome completo da empresa.")
	case !domain.In(domain.Estados, in.Estado):
		return domain.Invalid("Escolha o estado.")
	case in.CEP != "" && !cepRe.MatchString(in.CEP):
		return domain.Invalid("CEP no formato 00000-000.")
	case in.ContatoEmail != "" && !strings.Contains(in.ContatoEmail, "@"):
		return domain.Invalid("E-mail do contato inválido.")
	}
	return checkLen(in.Nome, in.Rua, in.Cidade, in.ContatoNome, in.Ramo)
}

func (s *Service) ListClientes(ctx context.Context, u domain.User) ([]sqlc.ListClientesRow, error) {
	return s.q.ListClientes(ctx, sqlc.ListClientesParams{EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()})
}

func (s *Service) Cliente(ctx context.Context, u domain.User, id uuid.UUID) (sqlc.GetClienteRow, error) {
	c, err := s.q.GetCliente(ctx, sqlc.GetClienteParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()})
	return c, notFound(err)
}

func (s *Service) CreateCliente(ctx context.Context, u domain.User, in ClienteInput) (sqlc.Cliente, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Cliente{}, err
	}
	if err := in.normalize(); err != nil {
		return sqlc.Cliente{}, err
	}
	return s.q.CreateCliente(ctx, sqlc.CreateClienteParams{
		EmpresaID: u.EmpresaID, RepresentanteID: u.ID, Situacao: in.Situacao, Nome: in.Nome, Rua: in.Rua,
		Numero: in.Numero, Cidade: in.Cidade, Estado: in.Estado, Cep: in.CEP, ContatoNome: in.ContatoNome,
		ContatoEmail: in.ContatoEmail, ContatoTelefone: in.ContatoTelefone, Ramo: in.Ramo,
	})
}

func (s *Service) UpdateCliente(ctx context.Context, u domain.User, id uuid.UUID, in ClienteInput) (sqlc.Cliente, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Cliente{}, err
	}
	if err := in.normalize(); err != nil {
		return sqlc.Cliente{}, err
	}
	c, err := s.q.UpdateCliente(ctx, sqlc.UpdateClienteParams{
		ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo(), Situacao: in.Situacao, Nome: in.Nome,
		Rua: in.Rua, Numero: in.Numero, Cidade: in.Cidade, Estado: in.Estado, Cep: in.CEP,
		ContatoNome: in.ContatoNome, ContatoEmail: in.ContatoEmail, ContatoTelefone: in.ContatoTelefone, Ramo: in.Ramo,
	})
	return c, notFound(err)
}

// ---------------------------------------------------------------- Visitas

type PlanejamentoInput struct {
	ClienteID         uuid.UUID `json:"cliente_id"`
	Motivo            string    `json:"motivo"`
	ResultadoEsperado string    `json:"resultado_esperado"`
	OQue              string    `json:"o_que"`
	ComQuem           string    `json:"com_quem"`
	Data              string    `json:"data"`
	Horario           string    `json:"horario"`
	Recursos          []string  `json:"recursos"`
	RecursosObs       string    `json:"recursos_obs"`
}

var horarioRe = regexp.MustCompile(`^[0-2]\d:[0-5]\d$`)

func (in *PlanejamentoInput) normalize() (time.Time, error) {
	in.Motivo, in.ResultadoEsperado, in.OQue = clean(in.Motivo), clean(in.ResultadoEsperado), clean(in.OQue)
	in.ComQuem, in.Horario, in.RecursosObs = clean(in.ComQuem), clean(in.Horario), clean(in.RecursosObs)
	if !domain.In(domain.Motivos, in.Motivo) {
		return time.Time{}, domain.Invalid("Marque o motivo da visita.")
	}
	data, err := parseDate(in.Data, "a data da visita")
	if err != nil {
		return data, err
	}
	if in.Horario != "" && !horarioRe.MatchString(in.Horario) {
		return data, domain.Invalid("Horário no formato 00:00.")
	}
	recursos := make([]string, 0, len(in.Recursos))
	for _, r := range in.Recursos {
		if !domain.In(domain.Recursos, r) {
			return data, domain.Invalid("Recurso inválido.")
		}
		if !domain.In(recursos, r) {
			recursos = append(recursos, r)
		}
	}
	in.Recursos = recursos
	return data, checkLen(in.ResultadoEsperado, in.OQue, in.ComQuem, in.RecursosObs)
}

func (s *Service) CreateVisita(ctx context.Context, u domain.User, in PlanejamentoInput) (sqlc.Visita, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Visita{}, err
	}
	data, err := in.normalize()
	if err != nil {
		return sqlc.Visita{}, err
	}
	// The cliente must be the representante's own — Escopo makes GetCliente say so.
	if _, err := s.Cliente(ctx, u, in.ClienteID); err != nil {
		return sqlc.Visita{}, err
	}
	return s.q.CreateVisita(ctx, sqlc.CreateVisitaParams{
		EmpresaID: u.EmpresaID, ClienteID: in.ClienteID, RepresentanteID: u.ID, Motivo: in.Motivo,
		ResultadoEsperado: in.ResultadoEsperado, OQue: in.OQue, ComQuem: in.ComQuem, Data: data,
		Horario: in.Horario, Recursos: in.Recursos, RecursosObs: in.RecursosObs,
	})
}

func (s *Service) UpdatePlanejamento(ctx context.Context, u domain.User, id uuid.UUID, in PlanejamentoInput) (sqlc.Visita, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Visita{}, err
	}
	data, err := in.normalize()
	if err != nil {
		return sqlc.Visita{}, err
	}
	v, err := s.q.UpdatePlanejamento(ctx, sqlc.UpdatePlanejamentoParams{
		ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.ID, Motivo: in.Motivo,
		ResultadoEsperado: in.ResultadoEsperado, OQue: in.OQue, ComQuem: in.ComQuem, Data: data,
		Horario: in.Horario, Recursos: in.Recursos, RecursosObs: in.RecursosObs,
	})
	return v, notFound(err)
}

type RealizacaoInput struct {
	Resultados        string `json:"resultados"`
	AspectosPositivos string `json:"aspectos_positivos"`
	Oportunidades     string `json:"oportunidades"`
	Pendencias        string `json:"pendencias"`
	PontosMelhorar    string `json:"pontos_melhorar"`
}

// Realizar records what happened. The first save stamps realizada_em; later saves edit
// the text and keep the stamp.
func (s *Service) Realizar(ctx context.Context, u domain.User, id uuid.UUID, in RealizacaoInput) (sqlc.Visita, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Visita{}, err
	}
	in = RealizacaoInput{clean(in.Resultados), clean(in.AspectosPositivos), clean(in.Oportunidades), clean(in.Pendencias), clean(in.PontosMelhorar)}
	if in.Resultados == "" {
		return sqlc.Visita{}, domain.Invalid("Conte o resultado conseguido na visita.")
	}
	if err := checkLen(in.Resultados, in.AspectosPositivos, in.Oportunidades, in.Pendencias, in.PontosMelhorar); err != nil {
		return sqlc.Visita{}, err
	}
	v, err := s.q.UpdateRealizacao(ctx, sqlc.UpdateRealizacaoParams{
		ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.ID, Resultados: in.Resultados,
		AspectosPositivos: in.AspectosPositivos, Oportunidades: in.Oportunidades, Pendencias: in.Pendencias,
		PontosMelhorar: in.PontosMelhorar,
	})
	return v, notFound(err)
}

type VisitaFiltro struct {
	RepresentanteID *uuid.UUID
	ClienteID       *uuid.UUID
	De, Ate         *time.Time
}

func (s *Service) ListVisitas(ctx context.Context, u domain.User, f VisitaFiltro) ([]sqlc.ListVisitasRow, error) {
	rep := f.RepresentanteID
	if esc := u.Escopo(); esc != nil {
		rep = esc
	}
	return s.q.ListVisitas(ctx, sqlc.ListVisitasParams{EmpresaID: u.EmpresaID, RepresentanteID: rep, ClienteID: f.ClienteID, De: f.De, Ate: f.Ate})
}

// VisitaDetalhe is everything the visita screen shows, in one read.
type VisitaDetalhe struct {
	Visita sqlc.GetVisitaRow
	Vendas []sqlc.ListVendasRow
	Acoes  []sqlc.ListAcoesRow
	// O feedback do gestor é por período; este é o que cobre a data da visita, se houver.
	Feedback *sqlc.FeedbackDaDataRow
}

func (s *Service) Visita(ctx context.Context, u domain.User, id uuid.UUID) (VisitaDetalhe, error) {
	var d VisitaDetalhe
	v, err := s.q.GetVisita(ctx, sqlc.GetVisitaParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()})
	if err != nil {
		return d, notFound(err)
	}
	d.Visita = v
	if d.Vendas, err = s.q.ListVendas(ctx, sqlc.ListVendasParams{EmpresaID: u.EmpresaID, VisitaID: &id}); err != nil {
		return d, err
	}
	if d.Acoes, err = s.q.ListAcoes(ctx, sqlc.ListAcoesParams{EmpresaID: u.EmpresaID, VisitaID: &id}); err != nil {
		return d, err
	}
	fb, err := s.q.FeedbackDaData(ctx, sqlc.FeedbackDaDataParams{EmpresaID: u.EmpresaID, RepresentanteID: v.RepresentanteID, Data: v.Data})
	switch {
	case err == nil:
		d.Feedback = &fb
	case !errors.Is(err, pgx.ErrNoRows):
		return d, err
	}
	return d, nil
}

// ---------------------------------------------------------------- Vendas

type VendaInput struct {
	ClienteID             uuid.UUID  `json:"cliente_id"`
	VisitaID              *uuid.UUID `json:"visita_id"`
	Data                  string     `json:"data"`
	Produto               string     `json:"produto"`
	Quantidade            float64    `json:"quantidade"`
	Unidade               string     `json:"unidade"`
	ValorUnitarioCentavos int64      `json:"valor_unitario_centavos"`
	Observacoes           string     `json:"observacoes"`
}

func (s *Service) CreateVenda(ctx context.Context, u domain.User, in VendaInput) (sqlc.Venda, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Venda{}, err
	}
	in.Produto, in.Unidade, in.Observacoes = clean(in.Produto), clean(in.Unidade), clean(in.Observacoes)
	data, err := parseDate(in.Data, "a data da venda")
	switch {
	case err != nil:
		return sqlc.Venda{}, err
	case in.Produto == "":
		return sqlc.Venda{}, domain.Invalid("Informe o produto.")
	case in.Quantidade <= 0:
		return sqlc.Venda{}, domain.Invalid("A quantidade precisa ser maior que zero.")
	case in.Unidade == "":
		return sqlc.Venda{}, domain.Invalid("Informe a unidade de medida.")
	case in.ValorUnitarioCentavos < 0:
		return sqlc.Venda{}, domain.Invalid("O valor unitário não pode ser negativo.")
	}
	if err := checkLen(in.Produto, in.Unidade, in.Observacoes); err != nil {
		return sqlc.Venda{}, err
	}
	if _, err := s.Cliente(ctx, u, in.ClienteID); err != nil {
		return sqlc.Venda{}, err
	}
	if in.VisitaID != nil {
		v, err := s.q.GetVisita(ctx, sqlc.GetVisitaParams{ID: *in.VisitaID, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()})
		if err != nil {
			return sqlc.Venda{}, notFound(err)
		}
		if v.ClienteID != in.ClienteID {
			return sqlc.Venda{}, domain.Invalid("A venda é de outro cliente que não o da visita.")
		}
	}
	venda, err := s.q.CreateVenda(ctx, sqlc.CreateVendaParams{
		EmpresaID: u.EmpresaID, ClienteID: in.ClienteID, RepresentanteID: u.ID, VisitaID: in.VisitaID, Data: data,
		Produto: in.Produto, Quantidade: in.Quantidade, Unidade: in.Unidade,
		ValorUnitarioCentavos: in.ValorUnitarioCentavos, Observacoes: in.Observacoes,
	})
	if err != nil {
		return venda, err
	}
	// Comprou: deixa de ser "1ª visita no cliente" e passa a "já é cliente".
	return venda, s.q.PromoverCliente(ctx, sqlc.PromoverClienteParams{ID: in.ClienteID, EmpresaID: u.EmpresaID})
}

func (s *Service) DeleteVenda(ctx context.Context, u domain.User, id uuid.UUID) error {
	if err := requireRepresentante(u); err != nil {
		return err
	}
	n, err := s.q.DeleteVenda(ctx, sqlc.DeleteVendaParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.ID})
	if err == nil && n == 0 {
		return domain.ErrNotFound
	}
	return err
}

func (s *Service) ListVendas(ctx context.Context, u domain.User, clienteID *uuid.UUID) ([]sqlc.ListVendasRow, error) {
	return s.q.ListVendas(ctx, sqlc.ListVendasParams{EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo(), ClienteID: clienteID})
}

// ---------------------------------------------------------------- Acompanhamento (ações)

type AcaoInput struct {
	Resultado string `json:"resultado"`
	OQue      string `json:"o_que"`
	Como      string `json:"como"`
	ComQuem   string `json:"com_quem"`
	Prazo     string `json:"prazo"`
}

func (s *Service) CreateAcao(ctx context.Context, u domain.User, visitaID uuid.UUID, in AcaoInput) (sqlc.Acao, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Acao{}, err
	}
	in = AcaoInput{clean(in.Resultado), clean(in.OQue), clean(in.Como), clean(in.ComQuem), clean(in.Prazo)}
	if in.OQue == "" {
		return sqlc.Acao{}, domain.Invalid("Diga o que vai fazer.")
	}
	prazo, err := parseOptionalDate(in.Prazo, "o prazo")
	if err != nil {
		return sqlc.Acao{}, err
	}
	if prazo == nil {
		return sqlc.Acao{}, domain.Invalid("Defina até quando — sem prazo a pendência é esquecida.")
	}
	if err := checkLen(in.Resultado, in.OQue, in.Como, in.ComQuem); err != nil {
		return sqlc.Acao{}, err
	}
	if _, err := s.q.GetVisita(ctx, sqlc.GetVisitaParams{ID: visitaID, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()}); err != nil {
		return sqlc.Acao{}, notFound(err)
	}
	return s.q.CreateAcao(ctx, sqlc.CreateAcaoParams{
		EmpresaID: u.EmpresaID, VisitaID: visitaID, RepresentanteID: u.ID, Resultado: in.Resultado,
		OQue: in.OQue, Como: in.Como, ComQuem: in.ComQuem, Prazo: prazo,
	})
}

func (s *Service) SetAcaoConcluida(ctx context.Context, u domain.User, id uuid.UUID, concluida bool) (sqlc.Acao, error) {
	if err := requireRepresentante(u); err != nil {
		return sqlc.Acao{}, err
	}
	a, err := s.q.SetAcaoConcluida(ctx, sqlc.SetAcaoConcluidaParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.ID, Concluida: concluida})
	return a, notFound(err)
}

func (s *Service) DeleteAcao(ctx context.Context, u domain.User, id uuid.UUID) error {
	if err := requireRepresentante(u); err != nil {
		return err
	}
	n, err := s.q.DeleteAcao(ctx, sqlc.DeleteAcaoParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.ID})
	if err == nil && n == 0 {
		return domain.ErrNotFound
	}
	return err
}

func (s *Service) ListAcoes(ctx context.Context, u domain.User, soAbertas bool) ([]sqlc.ListAcoesRow, error) {
	return s.q.ListAcoes(ctx, sqlc.ListAcoesParams{EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo(), SoAbertas: soAbertas})
}

// ---------------------------------------------------------------- Feedback do gestor
//
// O gestor não avalia visita por visita: ele junta tudo o que o representante fez num
// período (um mês, um mês e meio) e dá um feedback só, item a item, como numa avaliação de
// desempenho. Na justificativa ele cita a visita que quiser.

type ItemFeedback struct {
	Nota          int    `json:"nota"`
	Justificativa string `json:"justificativa"`
}

type FeedbackInput struct {
	RepresentanteID            uuid.UUID    `json:"representante_id"`
	De                         string       `json:"de"`
	Ate                        string       `json:"ate"`
	Planejamento               ItemFeedback `json:"planejamento"`
	Resultados                 ItemFeedback `json:"resultados"`
	AspectosPositivos          ItemFeedback `json:"aspectos_positivos"`
	Oportunidades              ItemFeedback `json:"oportunidades"`
	PontosMelhorar             ItemFeedback `json:"pontos_melhorar"`
	Pendencias                 ItemFeedback `json:"pendencias"`
	Orientacao                 string       `json:"orientacao"`
	OrientacaoAnteriorAplicada *string      `json:"orientacao_anterior_aplicada"`
}

func (in *FeedbackInput) normalize() (de, ate time.Time, err error) {
	if de, err = parseDate(in.De, "o início do período"); err != nil {
		return de, ate, err
	}
	if ate, err = parseDate(in.Ate, "o fim do período"); err != nil {
		return de, ate, err
	}
	if de.After(ate) {
		return de, ate, domain.Invalid("O início do período é depois do fim.")
	}
	itens := []*ItemFeedback{&in.Planejamento, &in.Resultados, &in.AspectosPositivos, &in.Oportunidades, &in.PontosMelhorar, &in.Pendencias}
	for _, it := range itens {
		it.Justificativa = clean(it.Justificativa)
		if !domain.ValidNota(it.Nota) {
			return de, ate, domain.Invalid("Dê uma nota de 1 a 4 para cada item.")
		}
		if err := checkLen(it.Justificativa); err != nil {
			return de, ate, err
		}
	}
	in.Orientacao = clean(in.Orientacao)
	if err := checkLen(in.Orientacao); err != nil {
		return de, ate, err
	}
	if in.OrientacaoAnteriorAplicada != nil && !domain.In(domain.Aplicacoes, *in.OrientacaoAnteriorAplicada) {
		return de, ate, domain.Invalid("Resposta inválida sobre a orientação anterior.")
	}
	return de, ate, nil
}

// representanteDaEmpresa confirms the id is a representante of the gestor's own empresa.
func (s *Service) representanteDaEmpresa(ctx context.Context, u domain.User, id uuid.UUID) (sqlc.ListRepresentantesRow, error) {
	reps, err := s.q.ListRepresentantes(ctx, &u.EmpresaID)
	if err != nil {
		return sqlc.ListRepresentantesRow{}, err
	}
	for _, r := range reps {
		if r.ID == id {
			return r, nil
		}
	}
	return sqlc.ListRepresentantesRow{}, domain.ErrNotFound
}

func (s *Service) CriarFeedback(ctx context.Context, u domain.User, in FeedbackInput) (sqlc.Feedback, error) {
	if err := requireGestor(u); err != nil {
		return sqlc.Feedback{}, err
	}
	de, ate, err := in.normalize()
	if err != nil {
		return sqlc.Feedback{}, err
	}
	if _, err := s.representanteDaEmpresa(ctx, u, in.RepresentanteID); err != nil {
		return sqlc.Feedback{}, err
	}
	return s.q.CreateFeedback(ctx, sqlc.CreateFeedbackParams{
		EmpresaID: u.EmpresaID, RepresentanteID: in.RepresentanteID, GestorID: u.ID, De: de, Ate: ate,
		NotaPlanejamento: int16(in.Planejamento.Nota), JustPlanejamento: in.Planejamento.Justificativa,
		NotaResultados: int16(in.Resultados.Nota), JustResultados: in.Resultados.Justificativa,
		NotaAspectosPositivos: int16(in.AspectosPositivos.Nota), JustAspectosPositivos: in.AspectosPositivos.Justificativa,
		NotaOportunidades: int16(in.Oportunidades.Nota), JustOportunidades: in.Oportunidades.Justificativa,
		NotaPontosMelhorar: int16(in.PontosMelhorar.Nota), JustPontosMelhorar: in.PontosMelhorar.Justificativa,
		NotaPendencias: int16(in.Pendencias.Nota), JustPendencias: in.Pendencias.Justificativa,
		Orientacao: in.Orientacao, OrientacaoAnteriorAplicada: in.OrientacaoAnteriorAplicada,
	})
}

// AtualizarFeedback edits a feedback; the representante it is about never changes.
func (s *Service) AtualizarFeedback(ctx context.Context, u domain.User, id uuid.UUID, in FeedbackInput) (sqlc.Feedback, error) {
	if err := requireGestor(u); err != nil {
		return sqlc.Feedback{}, err
	}
	de, ate, err := in.normalize()
	if err != nil {
		return sqlc.Feedback{}, err
	}
	f, err := s.q.UpdateFeedback(ctx, sqlc.UpdateFeedbackParams{
		ID: id, EmpresaID: u.EmpresaID, GestorID: u.ID, De: de, Ate: ate,
		NotaPlanejamento: int16(in.Planejamento.Nota), JustPlanejamento: in.Planejamento.Justificativa,
		NotaResultados: int16(in.Resultados.Nota), JustResultados: in.Resultados.Justificativa,
		NotaAspectosPositivos: int16(in.AspectosPositivos.Nota), JustAspectosPositivos: in.AspectosPositivos.Justificativa,
		NotaOportunidades: int16(in.Oportunidades.Nota), JustOportunidades: in.Oportunidades.Justificativa,
		NotaPontosMelhorar: int16(in.PontosMelhorar.Nota), JustPontosMelhorar: in.PontosMelhorar.Justificativa,
		NotaPendencias: int16(in.Pendencias.Nota), JustPendencias: in.Pendencias.Justificativa,
		Orientacao: in.Orientacao, OrientacaoAnteriorAplicada: in.OrientacaoAnteriorAplicada,
	})
	return f, notFound(err)
}

// ListFeedbacks: the gestor reads the whole empresa (optionally one representante), a
// representante only what they received.
func (s *Service) ListFeedbacks(ctx context.Context, u domain.User, rep *uuid.UUID) ([]sqlc.ListFeedbacksRow, error) {
	if u.Papel == domain.PapelMaster {
		return nil, domain.ErrForbidden
	}
	if esc := u.Escopo(); esc != nil {
		rep = esc
	}
	return s.q.ListFeedbacks(ctx, sqlc.ListFeedbacksParams{EmpresaID: u.EmpresaID, RepresentanteID: rep})
}

func (s *Service) Feedback(ctx context.Context, u domain.User, id uuid.UUID) (sqlc.GetFeedbackRow, error) {
	if u.Papel == domain.PapelMaster {
		return sqlc.GetFeedbackRow{}, domain.ErrForbidden
	}
	f, err := s.q.GetFeedback(ctx, sqlc.GetFeedbackParams{ID: id, EmpresaID: u.EmpresaID, RepresentanteID: u.Escopo()})
	return f, notFound(err)
}

// FeedbackPeriodo is what the gestor reads before writing the feedback: everything the
// representante did in the period, and the orientação of the previous feedback.
type FeedbackPeriodo struct {
	Representante      sqlc.ListRepresentantesRow
	Visitas            []sqlc.ListVisitasRow
	Vendas             []sqlc.ListVendasRow
	Acoes              []sqlc.ListAcoesRow
	OrientacaoAnterior *sqlc.OrientacaoAnteriorRow
}

// PeriodoFeedback gathers the period. excluir is the feedback being edited, so its own
// orientação does not show up as "the previous one".
func (s *Service) PeriodoFeedback(ctx context.Context, u domain.User, rep uuid.UUID, de, ate time.Time, excluir *uuid.UUID) (FeedbackPeriodo, error) {
	var p FeedbackPeriodo
	if err := requireGestor(u); err != nil {
		return p, err
	}
	if de.After(ate) {
		return p, domain.Invalid("O início do período é depois do fim.")
	}
	var err error
	if p.Representante, err = s.representanteDaEmpresa(ctx, u, rep); err != nil {
		return p, err
	}
	if p.Visitas, err = s.q.ListVisitas(ctx, sqlc.ListVisitasParams{EmpresaID: u.EmpresaID, RepresentanteID: &rep, De: &de, Ate: &ate}); err != nil {
		return p, err
	}
	vendas, err := s.q.ListVendas(ctx, sqlc.ListVendasParams{EmpresaID: u.EmpresaID, RepresentanteID: &rep})
	if err != nil {
		return p, err
	}
	p.Vendas = []sqlc.ListVendasRow{}
	for _, v := range vendas {
		if !v.Data.Before(de) && !v.Data.After(ate) {
			p.Vendas = append(p.Vendas, v)
		}
	}
	acoes, err := s.q.ListAcoes(ctx, sqlc.ListAcoesParams{EmpresaID: u.EmpresaID, RepresentanteID: &rep})
	if err != nil {
		return p, err
	}
	// Os próximos passos das visitas do período, e os que seguem em aberto de visitas anteriores.
	doPeriodo := make(map[uuid.UUID]bool, len(p.Visitas))
	for _, v := range p.Visitas {
		doPeriodo[v.ID] = true
	}
	p.Acoes = []sqlc.ListAcoesRow{}
	for _, a := range acoes {
		if doPeriodo[a.VisitaID] || (a.ConcluidaEm == nil && a.CriadaEm.Before(ate.AddDate(0, 0, 1))) {
			p.Acoes = append(p.Acoes, a)
		}
	}
	oa, err := s.q.OrientacaoAnterior(ctx, sqlc.OrientacaoAnteriorParams{
		EmpresaID: u.EmpresaID, RepresentanteID: rep, De: de, ExcluirID: excluir,
	})
	switch {
	case err == nil:
		p.OrientacaoAnterior = &oa
	case !errors.Is(err, pgx.ErrNoRows):
		return p, err
	}
	return p, nil
}

// ---------------------------------------------------------------- Opções dos formulários

type Opcoes struct {
	Representantes []sqlc.ListRepresentantesRow
	Ramos          []string
	Produtos       []string
}

func (s *Service) Opcoes(ctx context.Context, u domain.User) (Opcoes, error) {
	var o Opcoes
	var err error
	if u.Papel == domain.PapelGestor {
		if o.Representantes, err = s.q.ListRepresentantes(ctx, &u.EmpresaID); err != nil {
			return o, err
		}
	}
	if o.Ramos, err = s.q.ListRamos(ctx, u.EmpresaID); err != nil {
		return o, err
	}
	o.Produtos, err = s.q.ListProdutos(ctx, u.EmpresaID)
	return o, err
}
