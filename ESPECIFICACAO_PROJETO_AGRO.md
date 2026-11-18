# Projeto Agro — Especificação consolidada

> Fontes: 4 reuniões gravadas (`audios/`, trechos do agro em `AGRO_trechos_reunioes.md`) e os documentos em `documentos/`:
> - `Relatório para Área Comercial 9 nov 2026.docx`: **versão final dos campos** (a Ana renomeou o arquivo para “9 de novembro” na última reunião)
> - `word APFESENTAÇÃO.docx`: roteiro da apresentação, dores do cliente, proposta de valor
> - `CFMSF Gestão de Campo e Feedback Comercial.pptx`: apresentação comercial (8 slides)
>
> Referências às reuniões: R1 = audio1111803746, R2 = audio1469022679, R3 = audio1930832953, R4 = audio1734125672.

---

## 1. Visão geral

**Nome provisório:** *Continuous Sales Management & Feedback no Agronegócio* — sigla ainda indefinida (aparece como **CSMF**, **CFMSF** e **SMF**; a Ana disse em R4 que “CFMSF – Gestão de Campo e Feedback Comercial” foi a forma que o Fernando preferiu). Subtítulo: *“Sistema para transformar Gestão Comercial em Resultados no Agronegócio.”*

**É um sistema separado do CSF/CPF.** Não usa competências nem RTF (R1: *“não tem nada a ver com aquele, aquilo lá não funciona para essa realidade”*; R4: *“o Agro já é outro sistema”*). Pode reaproveitar padrões já feitos no CSF: perfil Master, formulário de plano de ação, gráficos e a mesma lógica de bloquear as alterações do cliente.

**O que é:** um sistema de registro, acompanhamento, avaliação e feedback das atividades comerciais externas. O representante registra planejamento, visita, vendas e próximos passos; o gestor analisa, avalia e devolve orientação. Tudo alimenta dashboards.

**Não substitui o CRM.** Ele faz direcionamento ativo: dá estrutura e método de trabalho e cobra que sejam seguidos.

### 1.1 O cliente e o problema
- **Quem vende:** **Fernando Loppa**, da consultoria **Web Rural** (RS, há ~20 anos). É **parceiro** (não é consultor da Ana) e vai revender o sistema para as empresas que assessora.
- **Quem compra:** o **dono** de indústrias de pequeno e médio porte que fabricam insumos para o agro (agrotóxico, ração etc.), sediadas no RS e com representantes espalhados pelo Brasil (MT, MG...).
- **Quem usa no campo:** **representantes comerciais**, em geral não CLT, que representam várias empresas ao mesmo tempo. Ganham **comissão** (percentual sobre o que vendem). Algumas empresas dão carro; quase todas **reembolsam combustível**. Às vezes pedem **adiantamento** para viagens longas.
- **A dor:** *“O dono coloca representantes na rua, longe de seus olhos, mas não tem informação para saber como estão trabalhando, quais oportunidades estão aproveitando e que resultados estão produzindo.”* Os representantes saem sem planejamento, não dão retorno, prometem amostra ou visita técnica ao cliente e esquecem, não marcam data. As fazendas são distantes e muitas vezes ficam sem sinal.
- **Perfil do usuário:** gente “mais rude, de campo” (R1, R3). **Não pode ter muito detalhe e ninguém quer escrever.** Daí o **comando de voz** e as **marcações (checkbox)**. A visita tem que ser registrada **em poucos minutos**.

---

## 2. Perfis de acesso

| Perfil | Quem é | Vê | Pode |
|---|---|---|---|
| **Master** | Nós (Ana / equipe) | Todas as empresas | Criar empresa, definir limite de representantes, autorizar mudanças |
| **Dono / Gestor** | Dono da indústria **ou** gerente comercial (às vezes é a mesma pessoa) | Todos os representantes da empresa e todos os dashboards | Avaliar e dar feedback (seção 6) |
| **Representante** | Profissional de vendas | **Apenas os próprios** registros e dashboard | Preencher os formulários |
| **Consultor parceiro** *(em aberto)* | Fernando | ? | R1 cogitou dar acesso a ele, possivelmente via Master (“como se fosse o RH”). **Decidir.** |

Regras:
- Em R1 ficou aberto se dono e gestor serão **um só perfil**. A sugestão foi um perfil só, igual ao “Master” do CSF.
- **Limite de representantes por empresa.** O dono contrata para N representantes (ex.: 15) e paga mensalidade por esse número. Para aumentar, **precisa pedir**; só muda com **autorização da Ana**. O cliente **não pode alterar nada sozinho** (“mesma coisa do outro”).
- A identificação do representante (nome completo etc.) vem do **login/conta**, não é digitada em cada registro (R3).

---

## 3. Estrutura do registro: “templates” (telas/etapas)

A Ana chama cada seção de “template”. Cada uma vira um formulário próprio, e não um formulário único. Um registro é feito **por cliente**: um representante que atende 5 empresas terá 5 registros, e o dashboard do gestor junta tudo.

Regra geral: **sempre que possível, comando de voz ou marcação.** Exceção: na identificação (telefone, e-mail, CEP) a voz funciona mal porque transcreve literalmente.

### 3.1 Identificação
- **Tipo:** ( ) 1ª visita  ( ) Já é cliente
  *(Antes era Prospect / Lead / Cliente; o Fernando pediu para simplificar.)*
- **Representante / profissional de vendas:** nome completo (do login)
- **Cliente:** nome completo da empresa; endereço completo: rua, nº, estado, cidade, CEP
- **Contato:** nome completo, e-mail, telefone
- **Caracterização / ramo de atividade:** café, boi, frango etc. **Precisa ser filtrável** (ex.: “quais fazendas de café atendemos?” quando lançarem um produto para café)
- **Não guardar CNPJ** (dado sensível, R3)
- “Nossa participação” (o que e quanto compra) **saiu da identificação**: vai sair dos gráficos de vendas

### 3.2 Planejamento
**Motivo da visita** (marcação):
- ( ) 1ª visita
- ( ) Visita a cliente: pós-venda
- ( ) Visita a cliente: acompanhamento
- ( ) Reunião solicitada por iniciativa do representante
- ( ) Reunião convocada pelo cliente
- ( ) Suporte técnico / pendência(s) de campo

**Resultado que quer alcançar com a visita:** voz

**Plano de ação (formato do plano de ação do CSF):**
- O quê, com quem, quando, horário: voz
- Recursos necessários: diária, folder, amostra, combustível, profissional técnico (veterinário, engenheiro agrônomo). Precisa ser **avisado com antecedência**, porque o cliente fica esperando o técnico.

### 3.3 Realização (voz em todos)
- Resultados conseguidos (vale também para 1ª visita: “despertei interesse, ele pediu X”)
- Aspectos positivos da visita (“consegui falar com o dono”)
- Outras oportunidades de negócio identificadas
- Pendências com o cliente (o que precisa enviar ou resolver)
- Pontos a melhorar

### 3.4 Vendas
Registro do que foi vendido e de quanto vendeu no mês. **Preenche na vertical (formulário) e exibe na horizontal (tabela)**:

| Data | Produto | Quantidade vendida | Unidade de medida | Valor unitário (R$) | Valor total (R$) | Observações |
|---|---|---|---|---|---|---|

- Sempre em **reais** (pedido do Fernando)
- Aqui a voz **não** é adequada: campos estruturados
- Precisa ser ordenável por mês; *“chute é o que a gente não quer mais, o dono quer informação precisa”*
- Valor total pode ser calculado (qtd × unitário)

### 3.5 Acompanhamento (formato plano de ação)
- Resultado que quer alcançar
- O que vai fazer, como vai fazer, com quem precisa alinhar
- Do documento de apresentação: **próxima ação, responsável e prazo (até quando)**
- R1: *“mandar a amostra, pra quê, quando”*. Também existe a ideia de um **follow-up** depois.
- R4: a Ana cogitou incluir “recursos” aqui também

### 3.6 Feedback do gestor
Avaliação que o gestor faz do profissional de vendas. **Cada item recebe uma nota de 1 a 4 (marcação) e uma justificativa (voz).**

Itens avaliados: Planejamento · Resultados conseguidos · Aspectos positivos da visita · Novas oportunidades · Pontos a melhorar · Pendências com cliente

**Escala de referência** (par de propósito, sem “nota do meio”):
1. **Abaixo do esperado:** atende parcialmente, com falhas relevantes
2. **Dentro do esperado:** atende de forma consistente
3. **Acima do esperado:** supera em diversos aspectos
4. **Excelência:** performance de destaque, referência para outros

- O gestor **só avalia**. O plano de ação de pendências é do representante.
- Do documento de apresentação: registrar também **se o representante colocou a orientação em prática e se houve melhora nos resultados**.
- O representante **quer** receber feedback (é uma demanda dos próprios representantes).
- A Ana pode querer contextualizar melhor a escala depois.

---

## 4. Dashboards e filtros

**Gráficos:** por **vendedor**, por **região**, por **produto**, por **cliente**. Filtros **combináveis** (ex.: produto X na região Y; vendedor Z no MT). Também por **empresa** e **ramo/segmento**.

- Vendas ao longo dos meses: gráfico de **linha/barra** com filtro por produto, como o gráfico por RTF do CSF
- **Visão geral** (todos os vendedores, regiões e produtos) e **visão específica** (um vendedor, uma região, um produto)
- Navegação do gestor: clica no representante → vê as empresas dele → vê o gráfico
- Por região: ao selecionar “Mato Grosso”, mostra os representantes da região e o que cada um vendeu
- Por cliente: data das visitas, quanto compra, **vendido vs. prospectado**
- O representante vê só o próprio dashboard
- **Objetivo para o dono:** decidir se precisa atuar sobre o vendedor, abrir mercado, contratar (“só tem um cara no MT”) ou fazer promoção de um produto que não vende

---

## 5. Regras de negócio citadas
- Relatório preenchido e enviado **em até 3 dias após a visita/viagem** como condição para o **reembolso** (R1, texto do relatório antigo)
- O cliente visitado deve receber a **memória da reunião**, com os retornos combinados e os prazos definidos (R1)
- Todo compromisso (amostra, técnico, material) precisa de **data e responsável** para não ser esquecido
- Histórico comercial **fica na empresa** mesmo se o representante sair

---

## 6. Requisitos não funcionais / diferenciais (apresentação)
- **Simples de preencher**, registro em poucos minutos, sem burocracia
- **Uso no campo** (celular). *Atenção: fazendas sem sinal: avaliar modo offline com sincronização.*
- **Tempo real**: gestor e equipe veem dados atualizados
- **Implantação ágil, sem integração** e sem interferir nos sistemas da empresa
- **Ajustável** ao momento e à estratégia da empresa
- Comunicação direta e estruturada entre gestão e campo, mesmo à distância
- Identidade visual própria (logo enviado pela Ana no WhatsApp, **não está na pasta**). Apresentação usa título em marsala e fundo branco ou cinza claro.
- Ana pretende **patentear**. O cliente não troca a logo.
- Precisa de **domínio** e hospedagem

---

## 7. Cobertura dos desafios (slide 3) pelo sistema
Em R2 o Arthur ficou de verificar se cada desafio da apresentação é atendido:

| Desafio | Onde o sistema resolve |
|---|---|
| Falta de visibilidade do trabalho em campo | Planejamento + Realização + dashboards |
| Erros recorrentes / cobrar as mesmas ações | Acompanhamento com prazo e responsável + feedback |
| Descobrir tarde que cliente importante parou de comprar | Vendas por cliente ao longo dos meses (*sugestão: alerta de cliente sem compra há X dias*) |
| Sem informação concreta para dar feedback | Feedback do gestor com escala + justificativa |
| Distinguir dificuldade real de justificativa | Registro de realização + pontos a melhorar + histórico |
| Perder histórico quando o profissional sai | Dados ficam na conta da empresa |
| Perda de clientes sem saber a causa | Histórico de visitas, pendências e oportunidades por cliente |
| Comparar profissionais e regiões | Dashboards por vendedor e região |
| Sem registros consistentes para avaliar fatos | Campos objetivos/marcação |
| Oportunidades mal aproveitadas | “Outras oportunidades identificadas” + acompanhamento |
| Falar com quem está longe | Registro remoto em tempo real (*offline?*) |
| Confundir falta de competência com mercado/preço/produto | Cruzar feedback × vendas × produto/região |

---

## 8. Próximos passos acordados
1. **Arthur:** fazer o **protótipo o quanto antes** com base nas reuniões, documentos e logo. Primeiro revisão interna (Ana, Arthur, Mônica), depois demonstração ao **Fernando** (ele está animado e outros empresários querem ver). Se houver reunião com diretor, marcar para navegar juntos.
2. **Ana:** propor ao Fernando um **piloto/MVP**: uma empresa e uma área específica. Não começar pela **Minerva** (grande demais, “não pode dar errado”); se for a Minerva, só **1 líder + até 3 liderados**.
3. **Ana:** dar treinamento para gestores e representantes explicando cada campo.
4. **Ana:** enviar o logo e definir nome e sigla.

## 9. Perguntas em aberto
- Nome e sigla definitivos (CSMF × CFMSF × SMF)
- Dono e gestor: um perfil ou dois? Que acesso tem o consultor parceiro?
- Lista de produtos e unidades de medida: cadastro por empresa (lista fechada) ou texto livre?
- “Região”: derivada do estado do endereço do cliente ou cadastrada para o representante?
- Precisa de modo offline?
- Formato do follow-up depois do acompanhamento
- Controle de reembolso/adiantamento entra no sistema ou fica só a regra dos 3 dias?
- Voz: transcrição no navegador (Web Speech API) ou serviço externo?
- Stack, domínio e hospedagem
