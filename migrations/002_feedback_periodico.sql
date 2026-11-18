-- +goose Up

-- Reunião de 11/11/2026: o gestor não avalia visita por visita. Ele reúne o que o
-- representante fez num período (um mês, um mês e meio) e dá um feedback só, como numa
-- avaliação de desempenho. As notas por visita deixam de existir.
DROP TABLE feedbacks;

CREATE TABLE feedbacks (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id                uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    representante_id          uuid NOT NULL REFERENCES users (id),
    gestor_id                 uuid NOT NULL REFERENCES users (id),
    de                        date NOT NULL,
    ate                       date NOT NULL,
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
    -- A orientação do feedback ANTERIOR deste representante foi colocada em prática?
    orientacao_anterior_aplicada text CHECK (orientacao_anterior_aplicada IN ('sim', 'parcial', 'nao')),
    criado_em                 timestamptz NOT NULL DEFAULT now(),
    atualizado_em             timestamptz NOT NULL DEFAULT now(),
    CHECK (de <= ate)
);
CREATE INDEX feedbacks_rep_idx ON feedbacks (empresa_id, representante_id, ate DESC);

-- +goose Down
DROP TABLE feedbacks;

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
    orientacao_anterior_aplicada text CHECK (orientacao_anterior_aplicada IN ('sim', 'parcial', 'nao')),
    criado_em                 timestamptz NOT NULL DEFAULT now(),
    atualizado_em             timestamptz NOT NULL DEFAULT now()
);
