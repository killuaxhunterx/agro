-- +goose Up

-- Empresas clientes (as indústrias). O limite de representantes é contratual: só o master muda.
CREATE TABLE empresas (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                   text NOT NULL UNIQUE CHECK (btrim(nome) <> ''),
    limite_representantes  integer NOT NULL CHECK (limite_representantes >= 0),
    criada_em              timestamptz NOT NULL DEFAULT now()
);

-- master não pertence a empresa nenhuma; gestor e representante sempre pertencem.
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  uuid REFERENCES empresas (id) ON DELETE CASCADE,
    nome        text NOT NULL CHECK (btrim(nome) <> ''),
    email       text NOT NULL UNIQUE CHECK (email = lower(email)),
    senha_hash  text NOT NULL,
    papel       text NOT NULL CHECK (papel IN ('master', 'gestor', 'representante')),
    ativo       boolean NOT NULL DEFAULT true,
    criado_em   timestamptz NOT NULL DEFAULT now(),
    CHECK ((papel = 'master') = (empresa_id IS NULL))
);
CREATE INDEX users_empresa_idx ON users (empresa_id);

-- Sessão opaca: o cookie carrega o token, o banco só o SHA-256 dele.
CREATE TABLE sessions (
    token_hash  bytea PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expira_em   timestamptz NOT NULL,
    criada_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Identificação. Sem CNPJ, por decisão (dado sensível). Região = estado.
CREATE TABLE clientes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id        uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    representante_id  uuid NOT NULL REFERENCES users (id),
    situacao          text NOT NULL CHECK (situacao IN ('primeira_visita', 'cliente')),
    nome              text NOT NULL CHECK (btrim(nome) <> ''),
    rua               text NOT NULL DEFAULT '',
    numero            text NOT NULL DEFAULT '',
    cidade            text NOT NULL DEFAULT '',
    estado            text NOT NULL CHECK (estado ~ '^[A-Z]{2}$'),
    cep               text NOT NULL DEFAULT '',
    contato_nome      text NOT NULL DEFAULT '',
    contato_email     text NOT NULL DEFAULT '',
    contato_telefone  text NOT NULL DEFAULT '',
    ramo              text NOT NULL DEFAULT '',
    criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clientes_empresa_idx ON clientes (empresa_id, representante_id);

-- Planejamento + realização da visita. realizada_em nulo = ainda só planejada.
CREATE TABLE visitas (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    cliente_id          uuid NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
    representante_id    uuid NOT NULL REFERENCES users (id),
    motivo              text NOT NULL CHECK (motivo IN (
                            'primeira_visita', 'pos_venda', 'acompanhamento',
                            'iniciativa_representante', 'convocada_cliente', 'suporte_tecnico')),
    resultado_esperado  text NOT NULL DEFAULT '',
    o_que               text NOT NULL DEFAULT '',
    com_quem            text NOT NULL DEFAULT '',
    data                date NOT NULL,
    horario             text NOT NULL DEFAULT '' CHECK (horario = '' OR horario ~ '^[0-2][0-9]:[0-5][0-9]$'),
    recursos            text[] NOT NULL DEFAULT '{}',
    recursos_obs        text NOT NULL DEFAULT '',
    realizada_em        timestamptz,
    resultados          text NOT NULL DEFAULT '',
    aspectos_positivos  text NOT NULL DEFAULT '',
    oportunidades       text NOT NULL DEFAULT '',
    pendencias          text NOT NULL DEFAULT '',
    pontos_melhorar     text NOT NULL DEFAULT '',
    criada_em           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitas_empresa_idx ON visitas (empresa_id, data DESC);
CREATE INDEX visitas_cliente_idx ON visitas (cliente_id);

-- Vendas: valores em centavos; o total é derivado, nunca digitado.
CREATE TABLE vendas (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id               uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    cliente_id               uuid NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
    representante_id         uuid NOT NULL REFERENCES users (id),
    visita_id                uuid REFERENCES visitas (id) ON DELETE SET NULL,
    data                     date NOT NULL,
    produto                  text NOT NULL CHECK (btrim(produto) <> ''),
    quantidade               numeric(14, 3) NOT NULL CHECK (quantidade > 0),
    unidade                  text NOT NULL CHECK (btrim(unidade) <> ''),
    valor_unitario_centavos  bigint NOT NULL CHECK (valor_unitario_centavos >= 0),
    valor_total_centavos     bigint GENERATED ALWAYS AS (round(quantidade * valor_unitario_centavos)::bigint) STORED,
    observacoes              text NOT NULL DEFAULT '',
    criada_em                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendas_empresa_idx ON vendas (empresa_id, data);
CREATE INDEX vendas_cliente_idx ON vendas (cliente_id);

-- Acompanhamento (plano de ação): a próxima providência, com prazo.
CREATE TABLE acoes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id        uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    visita_id         uuid NOT NULL REFERENCES visitas (id) ON DELETE CASCADE,
    representante_id  uuid NOT NULL REFERENCES users (id),
    resultado         text NOT NULL DEFAULT '',
    o_que             text NOT NULL CHECK (btrim(o_que) <> ''),
    como              text NOT NULL DEFAULT '',
    com_quem          text NOT NULL DEFAULT '',
    prazo             date,
    concluida_em      timestamptz,
    criada_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acoes_empresa_idx ON acoes (empresa_id, representante_id);

-- Feedback do gestor: uma avaliação por visita, escala 1–4 em seis itens.
CREATE TABLE feedbacks (
    visita_id                 uuid PRIMARY KEY REFERENCES visitas (id) ON DELETE CASCADE,
    empresa_id                uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    gestor_id                 uuid NOT NULL REFERENCES users (id),
    nota_planejamento         smallint NOT NULL CHECK (nota_planejamento BETWEEN 1 AND 4),
    just_planejamento         text NOT NULL DEFAULT '',
    nota_resultados           smallint NOT NULL CHECK (nota_resultados BETWEEN 1 AND 4),
    just_resultados           text NOT NULL DEFAULT '',
    nota_aspectos_positivos   smallint NOT NULL CHECK (nota_aspectos_positivos BETWEEN 1 AND 4),
    just_aspectos_positivos   text NOT NULL DEFAULT '',
    nota_oportunidades        smallint NOT NULL CHECK (nota_oportunidades BETWEEN 1 AND 4),
    just_oportunidades        text NOT NULL DEFAULT '',
    nota_pontos_melhorar      smallint NOT NULL CHECK (nota_pontos_melhorar BETWEEN 1 AND 4),
    just_pontos_melhorar      text NOT NULL DEFAULT '',
    nota_pendencias           smallint NOT NULL CHECK (nota_pendencias BETWEEN 1 AND 4),
    just_pendencias           text NOT NULL DEFAULT '',
    orientacao                text NOT NULL DEFAULT '',
    -- A orientação da avaliação ANTERIOR deste representante foi colocada em prática?
    orientacao_anterior_aplicada text CHECK (orientacao_anterior_aplicada IN ('sim', 'parcial', 'nao')),
    criado_em                 timestamptz NOT NULL DEFAULT now(),
    atualizado_em             timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE feedbacks;
DROP TABLE acoes;
DROP TABLE vendas;
DROP TABLE visitas;
DROP TABLE clientes;
DROP TABLE sessions;
DROP TABLE users;
DROP TABLE empresas;
