# Gestão de Campo e Feedback Comercial (projeto agro)

Protótipo do sistema de registro, acompanhamento e feedback da atuação dos representantes
comerciais das indústrias de insumos agro. Especificação em
[`ESPECIFICACAO_PROJETO_AGRO.md`](ESPECIFICACAO_PROJETO_AGRO.md). O material das reuniões
(áudios, transcrições e documentos do cliente) fica fora do repositório.

**Stack igual à do CSF:** Go 1.26 (net/http, pgx, goose, sqlc) + PostgreSQL 18 + React 19,
Vite, Tailwind 4, TanStack Query e react-router. É um sistema separado do CSF: não tem
competências nem RTF.

## Como rodar

### Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| [Go](https://go.dev/dl/) | 1.26+ | API |
| [Node.js](https://nodejs.org/) | 24+ | frontend |
| [pnpm](https://pnpm.io/installation) | 10+ | dependências do frontend (`npm i -g pnpm` ou `corepack enable`) |
| [Docker](https://docs.docker.com/get-docker/) | qualquer recente | Postgres 18 de desenvolvimento |
| `make` | — | atalhos dos comandos (`make help` lista todos) |

Opcional: [sqlc](https://sqlc.dev) só para regenerar `internal/store/sqlc` depois de mudar as queries.

### Passo a passo

```bash
git clone https://github.com/killuaxhunterx/agro.git
cd agro

cp .env.example .env            # a DATABASE_URL padrão já aponta para o container abaixo
pnpm --dir frontend install     # dependências do frontend
make db-up                      # Postgres em localhost:5435 (container agro-postgres)
make migrate-up                 # cria as tabelas
make demo                       # empresa fictícia com ~8 meses de dados
make up                         # API (porta 8981) + frontend
```

Abra **http://localhost:5974**. `Ctrl+C` derruba a API e o frontend juntos.

### Outros modos

- `make serve`: compila e sobe tudo num processo só, com a API servindo o frontend
  compilado (útil para demonstração). Acesse na `PORT` do `.env` (padrão 8080).
- `make dev` / `make web`: só a API ou só o frontend.
- `make demo-reset`: **apaga** o banco de dev inteiro e recria o demo.
- `make audit`: vet, gofmt, typecheck, oxlint, os testes e o `sqlc diff`.
- `make test`: testes Go. Os de integração só rodam com `DATABASE_URL` exportada
  (`set -a; . ./.env; set +a; make test`); cada execução cria um banco descartável.

### Problemas comuns

- **Porta 5435 ocupada:** outro Postgres está nela. Pare-o, ou rode o container em outra
  porta e ajuste a `DATABASE_URL` no `.env`.
- **Login não mantém a sessão por http:** em `make up`/`make dev` o `COOKIE_SECURE` já é
  `false`; em `make serve` por http, mude `COOKIE_SECURE=false` no `.env`.
- **Ditado por voz:** sem `OPENAI_API_KEY` usa o reconhecimento do navegador
  (Chrome, Edge ou Safari; o Firefox não tem).

**Logins do demo** (senha `Campo2026!`): `master@demo.agro` (consultoria),
`gestor@demo.agro` (gestora) e os representantes `joao@` (RS), `ana@` (MG) e
`marcos@demo.agro` (MT). O MT vende pouco de propósito, e há clientes que pararam de
comprar e pendências atrasadas, para o painel ter o que mostrar.

Para criar o primeiro master num banco novo: `go run ./cmd/agro master criar <email> <nome> <senha>`.

## O que o protótipo faz

| Perfil | Telas |
|---|---|
| **Representante** (celular primeiro) | *Hoje* (próximas visitas, visitas sem registro, pendências), Identificação (1ª visita no cliente / já é cliente, e se já está cadastrado), visita em 7 partes: identificação, planejamento (motivo), plano de ação (começa pelo resultado), realização, o que foi vendido, acompanhamento com prazo e feedback do gestor; feedbacks recebidos, *Painel do representante* |
| **Gestor** (dono ou gerente comercial) | *Painel do gestor* com filtros combináveis (representante, região/UF, atividade, produto, cliente e período; clicar numa barra também filtra), vendas por mês, por vendedor, região, produto e cliente, tabela da equipe, clientes que pararam de comprar, quem está sem feedback há mais de um mês. **Feedback por período** (não por visita): escolhe o representante e o período, vê tudo o que ele fez nele e avalia cada item de 1–4 com justificativa, mais a pergunta "aplicou a orientação anterior?" |
| **Master** (consultoria) | Empresas, limite contratado de representantes (travado no banco) e inclusão ou desativação de usuários |

- **Voz em todo texto livre:** sem `OPENAI_API_KEY`, usa o reconhecimento de voz do
  navegador (Chrome, Edge, Safari); com a chave, usa a mesma transcrição do CSF.
- **Isolamento:** a empresa e o filtro de representante vêm sempre da sessão, nunca da
  requisição. O representante só lê e escreve o que é dele; o gestor lê toda a empresa e
  só escreve o feedback; o cliente não altera nada da configuração.
- Testes de integração em `internal/comercial/service_test.go` cobrem o isolamento, o
  limite e as regras do feedback, cada execução num banco descartável.

## Decisões provisórias (confirmar com a Ana)

- **Nome:** "Gestão de Campo e Feedback Comercial", por extenso. A sigla ainda não foi
  decidida (a Ana usou uma em inglês no PPT). A cor de fundo atrás da logo fica para depois.
- **Dono e gerente comercial** são um perfil só, o **gestor**. A empresa pode ter vários.
- **Região = estado (UF) do cliente.**
- **Produto e unidade** são texto livre, com sugestão dos que já foram usados. Não há
  catálogo por empresa.
- **"1ª visita no cliente / Já é cliente"** é dado do cliente (da empresa, não do
  representante); o **motivo** é dado de cada visita. A primeira venda muda o cliente para
  "já é cliente" automaticamente.
- **Número da visita** (1ª, 2ª, 3ª… neste cliente): calculado, ninguém marca. Aparece no
  Planejamento e também na Identificação do cliente (cadastro e ficha), a pedido do Arthur;
  na reunião de 11/11 a Ana sugeriu só no Planejamento. Conta as visitas da empresa ao
  cliente em ordem de data; visita planejada que passou sem registro não entra.
- **Feedback por período** (reunião de 11/11): o gestor avalia o conjunto do mês, não cada
  visita. A tela da visita só mostra o feedback cujo período a cobre. A migração 002 apaga
  os feedbacks antigos, que eram por visita.
- **Voz:** no plano de ação, só no resultado e no detalhe dos recursos. Data, horário e
  e-mail nunca têm voz (o ditado escreve "16 e 30" em vez de 16:30).
- **Relatório em até 3 dias / reembolso:** só aparece como aviso na tela *Hoje*. Não há
  controle de reembolso nem de adiantamento.

## Ainda não feito

- **Uma segunda versão do layout**, mais modular e com menos informação por tela, para
  comparar com esta junto do Fernando (esta fica como opção).
- Cliente com propriedades em mais de um estado: conferir com o Fernando como deve aparecer.

- Acesso do **consultor parceiro** (Fernando): falta decidir o que ele vê.
- **Modo offline** para fazendas sem sinal.
- Envio da **memória da reunião** ao cliente, lembretes por e-mail, convite por e-mail e
  recuperação de senha. Hoje o master cria a conta com senha provisória.
- RLS no Postgres (o CSF tem). Aqui o isolamento está só nas queries e nos serviços.
- Deploy (Dockerfile/nginx do CSF) e domínio.
