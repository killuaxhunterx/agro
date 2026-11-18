package comercial_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/knowrisk/agro/internal/admin"
	"github.com/knowrisk/agro/internal/comercial"
	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/migrations"
)

// newDB creates a throwaway database next to DATABASE_URL's, migrates it, and drops it at
// the end. Without DATABASE_URL the suite skips.
func newDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	base := os.Getenv("DATABASE_URL")
	if base == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("agro_test_%d", rand.Uint32())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(base)
	u.Path = "/" + name
	dsn := u.String()

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	p, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := p.Up(ctx); err != nil {
		t.Fatal(err)
	}
	_ = db.Close()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+name+" WITH (FORCE)")
		admin.Close()
	})
	return pool
}

type fixture struct {
	ad          *admin.Service
	cs          *comercial.Service
	gestor      domain.User
	repA, repB  domain.User
	outraGestor domain.User
}

func setup(t *testing.T) fixture {
	pool := newDB(t)
	ctx := context.Background()
	f := fixture{ad: admin.New(pool), cs: comercial.New(pool)}
	mk := func(empresa string, limite int) domain.User {
		e, err := f.ad.CreateEmpresa(ctx, empresa, limite)
		if err != nil {
			t.Fatal(err)
		}
		return domain.User{EmpresaID: e.ID}
	}
	user := func(base domain.User, email string, p domain.Papel) domain.User {
		eid := base.EmpresaID
		u, err := f.ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: email, Email: email, Senha: "Senha-de-teste-1", Papel: p})
		if err != nil {
			t.Fatal(err)
		}
		return domain.User{ID: u.ID, EmpresaID: eid, Papel: p}
	}
	e1 := mk("Empresa Um", 2)
	f.gestor = user(e1, "g@um.test", domain.PapelGestor)
	f.repA = user(e1, "a@um.test", domain.PapelRepresentante)
	f.repB = user(e1, "b@um.test", domain.PapelRepresentante)
	e2 := mk("Empresa Dois", 1)
	f.outraGestor = user(e2, "g@dois.test", domain.PapelGestor)
	return f
}

func cliente(t *testing.T, f fixture, u domain.User, nome, uf string) uuid.UUID {
	t.Helper()
	c, err := f.cs.CreateCliente(context.Background(), u, comercial.ClienteInput{Situacao: "cliente", Nome: nome, Estado: uf})
	if err != nil {
		t.Fatal(err)
	}
	return c.ID
}

func TestEscopo_RepresentanteSoVeOProprio_GestorVeTodos_OutraEmpresaNada(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	cliente(t, f, f.repA, "Fazenda A", "RS")
	cliente(t, f, f.repB, "Fazenda B", "MT")

	count := func(u domain.User) int {
		cs, err := f.cs.ListClientes(ctx, u)
		if err != nil {
			t.Fatal(err)
		}
		return len(cs)
	}
	if got := count(f.repA); got != 1 {
		t.Errorf("repA sees %d clientes, want 1", got)
	}
	if got := count(f.gestor); got != 2 {
		t.Errorf("gestor sees %d clientes, want 2", got)
	}
	if got := count(f.outraGestor); got != 0 {
		t.Errorf("gestor of another empresa sees %d clientes, want 0", got)
	}
}

func TestVisita_DeOutroRepresentante_EhNotFound(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	cB := cliente(t, f, f.repB, "Fazenda B", "MT")
	_, err := f.cs.CreateVisita(ctx, f.repA, comercial.PlanejamentoInput{
		ClienteID: cB, Motivo: "acompanhamento", Data: time.Now().Format("2006-01-02"),
	})
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("planning a visit to another rep's cliente: err = %v, want ErrNotFound", err)
	}
}

func TestFeedback_PorPeriodo_SoGestorDaEmpresa(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	nota := comercial.ItemFeedback{Nota: 3}
	in := comercial.FeedbackInput{
		RepresentanteID: f.repA.ID, De: "2026-10-01", Ate: "2026-10-31", Orientacao: "Leve o folder.",
		Planejamento: nota, Resultados: nota, AspectosPositivos: nota, Oportunidades: nota, PontosMelhorar: nota, Pendencias: nota,
	}

	if _, err := f.cs.CriarFeedback(ctx, f.repA, in); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("feedback by representante: err = %v, want ErrForbidden", err)
	}
	if _, err := f.cs.CriarFeedback(ctx, f.outraGestor, in); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("feedback on another empresa's representante: err = %v, want ErrNotFound", err)
	}
	var ve *domain.ValidationError
	bad := in
	bad.Pendencias.Nota = 5
	if _, err := f.cs.CriarFeedback(ctx, f.gestor, bad); !errors.As(err, &ve) {
		t.Fatalf("nota 5: err = %v, want ValidationError", err)
	}
	bad = in
	bad.De, bad.Ate = "2026-10-31", "2026-10-01"
	if _, err := f.cs.CriarFeedback(ctx, f.gestor, bad); !errors.As(err, &ve) {
		t.Fatalf("de > ate: err = %v, want ValidationError", err)
	}
	fb, err := f.cs.CriarFeedback(ctx, f.gestor, in)
	if err != nil {
		t.Fatalf("valid feedback: %v", err)
	}

	// O representante lê o que recebeu; o outro representante, não.
	if _, err := f.cs.Feedback(ctx, f.repA, fb.ID); err != nil {
		t.Fatalf("repA reading own feedback: %v", err)
	}
	if _, err := f.cs.Feedback(ctx, f.repB, fb.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("repB reading repA's feedback: err = %v, want ErrNotFound", err)
	}
	if l, err := f.cs.ListFeedbacks(ctx, f.repB, &f.repA.ID); err != nil || len(l) != 0 {
		t.Fatalf("repB listing with repA's filter: %d rows, err %v; want 0", len(l), err)
	}
	if _, err := f.cs.AtualizarFeedback(ctx, f.outraGestor, fb.ID, in); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("another empresa's gestor editing: err = %v, want ErrNotFound", err)
	}

	// O período seguinte enxerga a orientação deste como a anterior; o mesmo período, editado, não.
	p, err := f.cs.PeriodoFeedback(ctx, f.gestor, f.repA.ID, time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 30, 0, 0, 0, 0, time.UTC), nil)
	if err != nil {
		t.Fatal(err)
	}
	if p.OrientacaoAnterior == nil || p.OrientacaoAnterior.ID != fb.ID {
		t.Fatalf("next period's orientação anterior = %+v, want feedback %s", p.OrientacaoAnterior, fb.ID)
	}
	p, err = f.cs.PeriodoFeedback(ctx, f.gestor, f.repA.ID, fb.De, fb.Ate, &fb.ID)
	if err != nil {
		t.Fatal(err)
	}
	if p.OrientacaoAnterior != nil {
		t.Fatalf("editing a feedback shows itself as the previous one")
	}
}

func TestVenda_PromoveClienteDaPrimeiraVisita(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	c, err := f.cs.CreateCliente(ctx, f.repA, comercial.ClienteInput{Situacao: "primeira_visita", Nome: "Fazenda Nova", Estado: "RS"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.cs.CreateVenda(ctx, f.repA, comercial.VendaInput{
		ClienteID: c.ID, Data: time.Now().Format("2006-01-02"), Produto: "Sal", Quantidade: 1, Unidade: "saco",
	}); err != nil {
		t.Fatal(err)
	}
	got, err := f.cs.Cliente(ctx, f.repA, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Situacao != "cliente" {
		t.Fatalf("situação after first sale = %q, want cliente", got.Situacao)
	}
}

func TestLimiteDeRepresentantes(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	eid := f.gestor.EmpresaID
	// Empresa Um tem limite 2 e já tem repA e repB.
	_, err := f.ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: "C", Email: "c@um.test", Senha: "Senha-de-teste-1", Papel: domain.PapelRepresentante})
	if !errors.Is(err, domain.ErrLimite) {
		t.Fatalf("third rep over limit 2: err = %v, want ErrLimite", err)
	}
	// Gestor não conta no limite.
	if _, err := f.ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: "G2", Email: "g2@um.test", Senha: "Senha-de-teste-1", Papel: domain.PapelGestor}); err != nil {
		t.Fatalf("second gestor: %v", err)
	}
	// Desativar libera a vaga; reativar acima do limite é recusado.
	if _, err := f.ad.SetAtivo(ctx, eid, f.repB.ID, false); err != nil {
		t.Fatal(err)
	}
	if _, err := f.ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: "C", Email: "c@um.test", Senha: "Senha-de-teste-1", Papel: domain.PapelRepresentante}); err != nil {
		t.Fatalf("rep after freeing a seat: %v", err)
	}
	if _, err := f.ad.SetAtivo(ctx, eid, f.repB.ID, true); !errors.Is(err, domain.ErrLimite) {
		t.Fatalf("reactivating over limit: err = %v, want ErrLimite", err)
	}
}

func TestPainel_RepresentanteForcadoAoProprioFiltro(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	hoje := time.Now().Format("2006-01-02")
	for _, rep := range []domain.User{f.repA, f.repB} {
		c := cliente(t, f, rep, "Fazenda "+rep.ID.String()[:4], "RS")
		if _, err := f.cs.CreateVenda(ctx, rep, comercial.VendaInput{
			ClienteID: c, Data: hoje, Produto: "Sal", Quantidade: 2, Unidade: "saco", ValorUnitarioCentavos: 1000,
		}); err != nil {
			t.Fatal(err)
		}
	}
	de := time.Now().AddDate(0, -1, 0)
	outro := f.repB.ID
	p, err := f.cs.Painel(ctx, f.repA, comercial.PainelFiltro{RepresentanteID: &outro, De: de, Ate: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	if len(p.PorRepresentante) != 1 || p.PorRepresentante[0].ID != f.repA.ID {
		t.Fatalf("repA asked for repB's painel and got %+v", p.PorRepresentante)
	}
	if p.PorRepresentante[0].TotalCentavos != 2000 {
		t.Errorf("total = %d, want 2000 (qtd × unitário)", p.PorRepresentante[0].TotalCentavos)
	}
	g, err := f.cs.Painel(ctx, f.gestor, comercial.PainelFiltro{De: de, Ate: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	if len(g.PorRepresentante) != 2 {
		t.Errorf("gestor painel has %d representantes, want 2", len(g.PorRepresentante))
	}
}

func TestVisita_NumeroNoCliente_IgnoraVisitaQuePassouSemRegistro(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	c := cliente(t, f, f.repA, "Fazenda Contada", "GO")
	dia := func(d int) string { return time.Now().AddDate(0, 0, d).Format("2006-01-02") }
	plan := func(d int) uuid.UUID {
		t.Helper()
		v, err := f.cs.CreateVisita(ctx, f.repA, comercial.PlanejamentoInput{ClienteID: c, Motivo: "acompanhamento", Data: dia(d)})
		if err != nil {
			t.Fatal(err)
		}
		return v.ID
	}
	plan(-20) // planejada e nunca registrada: não aconteceu
	feita := plan(-10)
	if _, err := f.cs.Realizar(ctx, f.repA, feita, comercial.RealizacaoInput{Resultados: "Pediu proposta"}); err != nil {
		t.Fatal(err)
	}
	proxima := plan(5)

	for id, want := range map[uuid.UUID]int32{feita: 1, proxima: 2} {
		d, err := f.cs.Visita(ctx, f.repA, id)
		if err != nil {
			t.Fatal(err)
		}
		if d.Visita.NumeroNoCliente != want {
			t.Errorf("numero_no_cliente = %d, want %d", d.Visita.NumeroNoCliente, want)
		}
	}
	cs, err := f.cs.ListClientes(ctx, f.repA)
	if err != nil {
		t.Fatal(err)
	}
	if len(cs) != 1 || cs[0].VisitasNoCliente != 2 {
		t.Fatalf("visitas_no_cliente = %+v, want 2", cs)
	}
	got, err := f.cs.Cliente(ctx, f.repA, c)
	if err != nil {
		t.Fatal(err)
	}
	if got.VisitasNoCliente != 2 {
		t.Fatalf("cliente visitas_no_cliente = %d, want 2", got.VisitasNoCliente)
	}
}
