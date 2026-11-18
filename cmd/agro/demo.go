package main

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/knowrisk/agro/internal/admin"
	"github.com/knowrisk/agro/internal/comercial"
	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

// Every name below is fictitious. The demo is for showing the product, never real data.
const (
	demoEmpresa = "Agroinsumos Demonstração Ltda"
	demoSenha   = "Campo2026!"
)

type demoRep struct {
	nome, email, estado string
	cidades             []string
	clientes            int
	ritmo               float64 // multiplica volume de vendas: o MT vende pouco de propósito
}

type demoProduto struct {
	nome, unidade string
	centavos      int64
	qtdMin        int
	qtdMax        int
}

var (
	demoReps = []demoRep{
		{"João Pereira", "joao@demo.agro", "RS", []string{"Passo Fundo", "Cruz Alta", "Santa Rosa", "Ijuí"}, 6, 1.0},
		{"Ana Ribeiro", "ana@demo.agro", "MG", []string{"Uberaba", "Patos de Minas", "Araxá", "Unaí"}, 5, 1.2},
		{"Marcos Lima", "marcos@demo.agro", "MT", []string{"Sorriso", "Lucas do Rio Verde", "Rondonópolis"}, 4, 0.5},
	}
	demoRamos    = []string{"Bovinocultura de corte", "Pecuária leiteira", "Avicultura", "Suinocultura", "Café", "Soja e milho"}
	demoProdutos = []demoProduto{
		{"Ração Bovina Engorda", "saco 40 kg", 9850, 40, 200},
		{"Sal Mineral Proteinado", "saco 30 kg", 14200, 20, 120},
		{"Núcleo Leite Alta Produção", "saco 25 kg", 18990, 10, 80},
		{"Ração Inicial Frango", "tonelada", 265000, 2, 12},
		{"Fungicida Foliar", "litro", 8700, 20, 150},
		{"Adubo Foliar Café", "litro", 5400, 30, 200},
	}
	demoFazendas = []string{"Fazenda Santa Luzia", "Agropecuária Boa Vista", "Granja São Pedro", "Fazenda Três Irmãos",
		"Sítio Recanto Verde", "Fazenda Esperança", "Cooperativa Vale do Campo", "Fazenda Bom Retiro",
		"Agropastoril Primavera", "Granja Sol Nascente", "Fazenda Água Limpa", "Laticínio Serra Azul",
		"Fazenda Capão Alto", "Fazenda Barra Grande", "Agro Pinheiral"}
	demoContatos = []string{"Sr. Valdir", "Dona Marlene", "Roberto (gerente)", "Cláudio", "Sandra (compras)", "Seu Antônio", "Paulo (veterinário)"}

	demoResultadoEsperado = []string{
		"Apresentar a linha de sal mineral e deixar amostra para teste no lote de engorda.",
		"Fechar o pedido do mês e entender o consumo previsto para a seca.",
		"Levar o veterinário para avaliar o problema de conversão alimentar relatado.",
		"Retomar o contato: o cliente não compra há algum tempo e quero entender o motivo.",
		"Conhecer a propriedade e levantar o que compra hoje e de quem.",
	}
	demoResultados = []string{
		"Cliente aceitou testar o produto em um lote de 50 animais. Pedido inicial fechado.",
		"Fechei o pedido do mês. Ele pediu prazo de 60 dias, ficou de confirmar com o financeiro.",
		"O veterinário identificou falha no manejo do cocho; cliente gostou do suporte e vai ampliar a compra.",
		"Consegui falar com o dono, que estava insatisfeito com o atraso da última entrega. Expliquei e ficou de voltar a comprar.",
		"Primeiro contato bom. Compra hoje do concorrente, mas mostrou interesse no núcleo para leite.",
	}
	demoPositivos     = []string{"Consegui falar direto com o dono.", "Cliente elogiou o atendimento técnico.", "Recebeu bem a amostra.", "Abriu as portas para visitar a outra fazenda da família."}
	demoOportunidades = []string{"Tem uma segunda propriedade com confinamento — potencial para ração de engorda.", "Vizinho também cria frango e pode virar cliente.", "Pode comprar adubo foliar para o café na próxima safra.", ""}
	demoPendencias    = []string{"Enviar a tabela de preços atualizada.", "Mandar amostra de 2 sacos do núcleo.", "Agendar a visita do agrônomo.", ""}
	demoMelhorar      = []string{"Deveria ter levado o folder técnico.", "Cheguei atrasado por causa da estrada.", "Faltou levar a amostra que tinha prometido.", ""}
	demoAcoes         = []struct{ oQue, como, comQuem, resultado string }{
		{"Enviar amostra do núcleo para leite", "Pedir para a expedição despachar pela transportadora", "Expedição da indústria", "Cliente testar e fechar pedido"},
		{"Agendar visita do agrônomo", "Combinar data com o técnico e confirmar com o cliente", "Engenheiro agrônomo", "Resolver a dúvida técnica e ganhar confiança"},
		{"Mandar tabela de preços e condições", "Enviar por WhatsApp e confirmar recebimento", "Gerente comercial", "Fechar o pedido do próximo mês"},
		{"Retornar sobre o prazo de pagamento", "Ver com o financeiro se aceita 60 dias", "Financeiro", "Não perder o pedido"},
	}
	demoJust = map[int][]string{
		1: {"Faltou planejamento: não levou o material combinado.", "O registro ficou vago, sem dizer o que foi feito."},
		2: {"Visita bem conduzida, dentro do esperado.", "Cumpriu o planejado."},
		3: {"Foi além: identificou oportunidade nova na propriedade.", "Ótimo uso do suporte técnico."},
		4: {"Referência para a equipe: planejou, executou e já deixou a próxima ação marcada."},
	}
	demoOrientacoes = []string{
		"Sempre confirme na véspera se o cliente está na fazenda e leve o folder técnico.",
		"Defina a data de retorno ainda na visita, na frente do cliente.",
		"Explore a segunda propriedade: peça para conhecer o confinamento.",
		"",
	}
)

func pick[T any](r *rand.Rand, xs []T) T { return xs[r.IntN(len(xs))] }

func runDemo(ctx context.Context, pool *pgxpool.Pool, ad *admin.Service, cs *comercial.Service) error {
	q := sqlc.New(pool)
	if _, err := q.EmpresaByNome(ctx, demoEmpresa); err == nil {
		return fmt.Errorf("a empresa %q já existe — o demo já foi criado", demoEmpresa)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if _, err := q.UserByEmail(ctx, "master@demo.agro"); errors.Is(err, pgx.ErrNoRows) {
		if _, err := ad.CreateUser(ctx, admin.NovoUsuario{Nome: "Consultoria (master)", Email: "master@demo.agro", Senha: demoSenha, Papel: domain.PapelMaster}); err != nil {
			return fmt.Errorf("master: %w", err)
		}
	}

	emp, err := ad.CreateEmpresa(ctx, demoEmpresa, 5)
	if err != nil {
		return err
	}
	eid := emp.ID
	gu, err := ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: "Carla Mendes", Email: "gestor@demo.agro", Senha: demoSenha, Papel: domain.PapelGestor})
	if err != nil {
		return fmt.Errorf("gestor: %w", err)
	}
	gestor := domain.User{ID: gu.ID, EmpresaID: eid, Papel: domain.PapelGestor}

	r := rand.New(rand.NewPCG(2026, 11))
	hoje := time.Now().UTC().Truncate(24 * time.Hour)
	fazenda := 0

	for _, dr := range demoReps {
		ru, err := ad.CreateUser(ctx, admin.NovoUsuario{EmpresaID: &eid, Nome: dr.nome, Email: dr.email, Senha: demoSenha, Papel: domain.PapelRepresentante})
		if err != nil {
			return fmt.Errorf("representante %s: %w", dr.nome, err)
		}
		rep := domain.User{ID: ru.ID, EmpresaID: eid, Papel: domain.PapelRepresentante}

		for ci := 0; ci < dr.clientes; ci++ {
			nome := demoFazendas[fazenda%len(demoFazendas)]
			fazenda++
			situacao := "cliente"
			if ci == dr.clientes-1 {
				situacao = "primeira_visita"
			}
			cli, err := cs.CreateCliente(ctx, rep, comercial.ClienteInput{
				Situacao: situacao, Nome: nome, Rua: "Estrada Municipal, km " + fmt.Sprint(2+r.IntN(40)),
				Numero: "s/n", Cidade: pick(r, dr.cidades), Estado: dr.estado, CEP: fmt.Sprintf("%05d-%03d", 70000+r.IntN(29999), r.IntN(999)),
				ContatoNome: pick(r, demoContatos), ContatoEmail: "", ContatoTelefone: fmt.Sprintf("(%02d) 9%04d-%04d", 51+r.IntN(30), r.IntN(9999), r.IntN(9999)),
				Ramo: pick(r, demoRamos),
			})
			if err != nil {
				return fmt.Errorf("cliente: %w", err)
			}

			// Visitas realizadas nos últimos ~8 meses. O segundo cliente de cada um para de
			// comprar há três meses — é o alerta "cliente importante que sumiu".
			nVisitas := 6 + r.IntN(3)
			if situacao == "primeira_visita" {
				nVisitas = 1
			}
			parouDeComprar := ci == 1
			for vi := 0; vi < nVisitas; vi++ {
				// Espalhadas de ~8 meses atrás até a semana atual, a mais antiga primeiro.
				var dias int
				if nVisitas > 1 {
					dias = 4 + (nVisitas-1-vi)*230/(nVisitas-1) - r.IntN(4)
				} else {
					dias = 15 + r.IntN(30)
				}
				if parouDeComprar && dias < 95 {
					dias = 95 + r.IntN(20)
				}
				data := hoje.AddDate(0, 0, -dias)
				motivo := "acompanhamento"
				switch {
				case situacao == "primeira_visita" || vi == 0:
					motivo = "primeira_visita"
				case vi%3 == 2:
					motivo = "pos_venda"
				case r.IntN(5) == 0:
					motivo = "suporte_tecnico"
				}
				recursos := []string{"combustivel"}
				if r.IntN(2) == 0 {
					recursos = append(recursos, "amostra")
				}
				if motivo == "suporte_tecnico" {
					recursos = append(recursos, "profissional_tecnico")
				}
				v, err := cs.CreateVisita(ctx, rep, comercial.PlanejamentoInput{
					ClienteID: cli.ID, Motivo: motivo, ResultadoEsperado: pick(r, demoResultadoEsperado),
					OQue: "Visita na propriedade", ComQuem: pick(r, demoContatos), Data: data.Format("2006-01-02"),
					Horario: fmt.Sprintf("%02d:%02d", 7+r.IntN(9), 15*r.IntN(4)), Recursos: recursos,
				})
				if err != nil {
					return fmt.Errorf("visita: %w", err)
				}
				if _, err := cs.Realizar(ctx, rep, v.ID, comercial.RealizacaoInput{
					Resultados: pick(r, demoResultados), AspectosPositivos: pick(r, demoPositivos),
					Oportunidades: pick(r, demoOportunidades), Pendencias: pick(r, demoPendencias), PontosMelhorar: pick(r, demoMelhorar),
				}); err != nil {
					return fmt.Errorf("realizacao: %w", err)
				}

				if situacao == "cliente" && r.Float64() < 0.85 {
					for range 1 + r.IntN(2) {
						p := pick(r, demoProdutos)
						qtd := float64(p.qtdMin + r.IntN(p.qtdMax-p.qtdMin+1))
						qtd = float64(int(qtd*dr.ritmo + 1))
						vid := v.ID
						if _, err := cs.CreateVenda(ctx, rep, comercial.VendaInput{
							ClienteID: cli.ID, VisitaID: &vid, Data: data.Format("2006-01-02"), Produto: p.nome,
							Quantidade: qtd, Unidade: p.unidade, ValorUnitarioCentavos: p.centavos,
						}); err != nil {
							return fmt.Errorf("venda: %w", err)
						}
					}
				}

				if r.Float64() < 0.6 {
					a := pick(r, demoAcoes)
					prazo := data.AddDate(0, 0, 5+r.IntN(10))
					acao, err := cs.CreateAcao(ctx, rep, v.ID, comercial.AcaoInput{
						Resultado: a.resultado, OQue: a.oQue, Como: a.como, ComQuem: a.comQuem, Prazo: prazo.Format("2006-01-02"),
					})
					if err != nil {
						return fmt.Errorf("acao: %w", err)
					}
					// As antigas quase sempre foram feitas; as recentes, nem sempre.
					if dias > 45 || r.IntN(3) == 0 {
						if _, err := cs.SetAcaoConcluida(ctx, rep, acao.ID, true); err != nil {
							return err
						}
					}
				}

			}

			// Uma visita planejada para os próximos dias, e — só no MT — uma que passou sem registro.
			if ci%2 == 0 {
				if _, err := cs.CreateVisita(ctx, rep, comercial.PlanejamentoInput{
					ClienteID: cli.ID, Motivo: "acompanhamento", ResultadoEsperado: pick(r, demoResultadoEsperado),
					OQue: "Visita de acompanhamento", ComQuem: pick(r, demoContatos),
					Data: hoje.AddDate(0, 0, 1+r.IntN(10)).Format("2006-01-02"), Horario: "09:00",
					Recursos: []string{"combustivel", "folder"},
				}); err != nil {
					return err
				}
			}
			if dr.estado == "MT" && ci == 0 {
				if _, err := cs.CreateVisita(ctx, rep, comercial.PlanejamentoInput{
					ClienteID: cli.ID, Motivo: "pos_venda", ResultadoEsperado: "Ver como foi o uso do sal mineral.",
					OQue: "Pós-venda", Data: hoje.AddDate(0, 0, -6).Format("2006-01-02"), Recursos: []string{"combustivel"},
				}); err != nil {
					return err
				}
			}
		}

		// Feedback mensal da gestora, mês fechado a mês fechado. O mês corrente ainda não foi
		// avaliado; o MT está sem feedback há mais tempo — aparece no painel.
		ultimo := 1
		if dr.ritmo < 1 {
			ultimo = 2
		}
		base := 2
		if dr.ritmo < 1 {
			base = 1
		} else if dr.ritmo > 1 {
			base = 3
		}
		inicioMes := time.Date(hoje.Year(), hoje.Month(), 1, 0, 0, 0, 0, time.UTC)
		for m := 7; m >= ultimo; m-- {
			de := inicioMes.AddDate(0, -m, 0)
			ate := de.AddDate(0, 1, -1)
			nota := func() comercial.ItemFeedback {
				n := min(max(base+r.IntN(3)-1, 1), 4)
				return comercial.ItemFeedback{Nota: n, Justificativa: pick(r, demoJust[n])}
			}
			var aplicada *string
			if m < 7 {
				a := pick(r, domain.Aplicacoes)
				aplicada = &a
			}
			if _, err := cs.CriarFeedback(ctx, gestor, comercial.FeedbackInput{
				RepresentanteID: rep.ID, De: de.Format("2006-01-02"), Ate: ate.Format("2006-01-02"),
				Planejamento: nota(), Resultados: nota(), AspectosPositivos: nota(), Oportunidades: nota(),
				PontosMelhorar: nota(), Pendencias: nota(), Orientacao: pick(r, demoOrientacoes[:3]),
				OrientacaoAnteriorAplicada: aplicada,
			}); err != nil {
				return fmt.Errorf("feedback: %w", err)
			}
		}
	}

	fmt.Printf("Empresa de demonstração criada: %s\n", demoEmpresa)
	fmt.Printf("Senha de todos: %s\n", demoSenha)
	fmt.Println("  master@demo.agro   (consultoria)")
	fmt.Println("  gestor@demo.agro   (gestora — Carla Mendes)")
	for _, dr := range demoReps {
		fmt.Printf("  %-18s (representante — %s, %s)\n", dr.email, dr.nome, dr.estado)
	}
	return nil
}
