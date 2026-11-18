-- Tudo aqui recebe empresa_id, e o filtro de representante quando o leitor é representante
-- (sqlc.narg nulo = sem filtro, que é a visão do gestor).

-- name: ListRepresentantes :many
SELECT id, nome, email, ativo FROM users
WHERE empresa_id = $1 AND papel = 'representante'
ORDER BY nome;

-- name: CreateCliente :one
INSERT INTO clientes (empresa_id, representante_id, situacao, nome, rua, numero, cidade, estado, cep,
                      contato_nome, contato_email, contato_telefone, ramo)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: UpdateCliente :one
UPDATE clientes SET situacao = $3, nome = $4, rua = $5, numero = $6, cidade = $7, estado = $8, cep = $9,
                    contato_nome = $10, contato_email = $11, contato_telefone = $12, ramo = $13
WHERE id = $1 AND empresa_id = $2
  AND (sqlc.narg('representante_id')::uuid IS NULL OR representante_id = sqlc.narg('representante_id'))
RETURNING *;

-- name: GetCliente :one
SELECT c.*, u.nome AS representante_nome,
       -- Mesma conta de ListClientes: a próxima visita é a visitas_no_cliente + 1.
       (SELECT count(*) FROM visitas o
        WHERE o.cliente_id = c.id AND o.empresa_id = c.empresa_id
          AND (o.realizada_em IS NOT NULL OR o.data >= current_date))::int AS visitas_no_cliente
FROM clientes c JOIN users u ON u.id = c.representante_id
WHERE c.id = $1 AND c.empresa_id = $2
  AND (sqlc.narg('representante_id')::uuid IS NULL OR c.representante_id = sqlc.narg('representante_id'));

-- name: ListClientes :many
SELECT c.*, u.nome AS representante_nome,
       vv.ultima_compra, vi.ultima_visita,
       COALESCE(vv.total, 0)::bigint AS total_vendido_centavos,
       -- Visitas que contam para a numeração (ver GetVisita): a próxima é a visitas_no_cliente + 1.
       (SELECT count(*) FROM visitas o
        WHERE o.cliente_id = c.id AND o.empresa_id = c.empresa_id
          AND (o.realizada_em IS NOT NULL OR o.data >= current_date))::int AS visitas_no_cliente
FROM clientes c
JOIN users u ON u.id = c.representante_id
LEFT JOIN (SELECT cliente_id, max(data) AS ultima_compra, sum(valor_total_centavos) AS total
           FROM vendas GROUP BY cliente_id) vv ON vv.cliente_id = c.id
LEFT JOIN (SELECT cliente_id, max(data) AS ultima_visita
           FROM visitas WHERE realizada_em IS NOT NULL GROUP BY cliente_id) vi ON vi.cliente_id = c.id
WHERE c.empresa_id = $1
  AND (sqlc.narg('representante_id')::uuid IS NULL OR c.representante_id = sqlc.narg('representante_id'))
ORDER BY c.nome;

-- name: ListRamos :many
SELECT DISTINCT ramo FROM clientes WHERE empresa_id = $1 AND ramo <> '' ORDER BY ramo;

-- name: ListProdutos :many
SELECT DISTINCT produto FROM vendas WHERE empresa_id = $1 ORDER BY produto;

-- name: CreateVisita :one
INSERT INTO visitas (empresa_id, cliente_id, representante_id, motivo, resultado_esperado, o_que, com_quem,
                     data, horario, recursos, recursos_obs)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdatePlanejamento :one
UPDATE visitas SET motivo = $3, resultado_esperado = $4, o_que = $5, com_quem = $6, data = $7, horario = $8,
                   recursos = $9, recursos_obs = $10
WHERE id = $1 AND empresa_id = $2 AND representante_id = $11
RETURNING *;

-- name: UpdateRealizacao :one
UPDATE visitas SET realizada_em = COALESCE(realizada_em, now()), resultados = $3, aspectos_positivos = $4,
                   oportunidades = $5, pendencias = $6, pontos_melhorar = $7
WHERE id = $1 AND empresa_id = $2 AND representante_id = $8
RETURNING *;

-- name: GetVisita :one
-- numero_no_cliente: é a 1ª, 2ª, 3ª… visita da empresa a este cliente, em ordem de data. Visita
-- planejada que passou sem registro não aconteceu e não entra na conta.
SELECT v.*, c.nome AS cliente_nome, c.estado AS cliente_estado, c.situacao AS cliente_situacao,
       u.nome AS representante_nome,
       (SELECT count(*) FROM visitas o
        WHERE o.cliente_id = v.cliente_id AND o.empresa_id = v.empresa_id
          AND (o.realizada_em IS NOT NULL OR o.data >= current_date OR o.id = v.id)
          AND (o.data, o.horario, o.criada_em, o.id) <= (v.data, v.horario, v.criada_em, v.id))::int AS numero_no_cliente
FROM visitas v
JOIN clientes c ON c.id = v.cliente_id
JOIN users u ON u.id = v.representante_id
WHERE v.id = $1 AND v.empresa_id = $2
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'));

-- name: ListVisitas :many
SELECT v.id, v.cliente_id, v.representante_id, v.motivo, v.data, v.horario, v.o_que, v.realizada_em,
       c.nome AS cliente_nome, c.estado AS cliente_estado, u.nome AS representante_nome,
       (SELECT count(*) FROM acoes a WHERE a.visita_id = v.id AND a.concluida_em IS NULL)::int AS acoes_abertas
FROM visitas v
JOIN clientes c ON c.id = v.cliente_id
JOIN users u ON u.id = v.representante_id
WHERE v.empresa_id = $1
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('de')::date IS NULL OR v.data >= sqlc.narg('de'))
  AND (sqlc.narg('ate')::date IS NULL OR v.data <= sqlc.narg('ate'))
ORDER BY v.data DESC, v.horario DESC NULLS LAST
LIMIT 300;

-- name: CreateVenda :one
INSERT INTO vendas (empresa_id, cliente_id, representante_id, visita_id, data, produto, quantidade, unidade,
                    valor_unitario_centavos, observacoes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: PromoverCliente :exec
-- A primeira compra faz da "1ª visita no cliente" um "já é cliente" — automático, ninguém marca.
UPDATE clientes SET situacao = 'cliente'
WHERE id = $1 AND empresa_id = $2 AND situacao = 'primeira_visita';

-- name: DeleteVenda :execrows
DELETE FROM vendas WHERE id = $1 AND empresa_id = $2 AND representante_id = $3;

-- name: ListVendas :many
SELECT v.*, c.nome AS cliente_nome, u.nome AS representante_nome
FROM vendas v
JOIN clientes c ON c.id = v.cliente_id
JOIN users u ON u.id = v.representante_id
WHERE v.empresa_id = $1
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('visita_id')::uuid IS NULL OR v.visita_id = sqlc.narg('visita_id'))
ORDER BY v.data DESC, v.criada_em DESC
LIMIT 500;

-- name: CreateAcao :one
INSERT INTO acoes (empresa_id, visita_id, representante_id, resultado, o_que, como, com_quem, prazo)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: SetAcaoConcluida :one
UPDATE acoes SET concluida_em = CASE WHEN sqlc.arg('concluida')::bool THEN COALESCE(concluida_em, now()) ELSE NULL END
WHERE id = $1 AND empresa_id = $2 AND representante_id = $3
RETURNING *;

-- name: DeleteAcao :execrows
DELETE FROM acoes WHERE id = $1 AND empresa_id = $2 AND representante_id = $3;

-- name: ListAcoes :many
SELECT a.*, c.nome AS cliente_nome, c.id AS cliente_id, u.nome AS representante_nome
FROM acoes a
JOIN visitas v ON v.id = a.visita_id
JOIN clientes c ON c.id = v.cliente_id
JOIN users u ON u.id = a.representante_id
WHERE a.empresa_id = $1
  AND (sqlc.narg('representante_id')::uuid IS NULL OR a.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('visita_id')::uuid IS NULL OR a.visita_id = sqlc.narg('visita_id'))
  AND (NOT sqlc.arg('so_abertas')::bool OR a.concluida_em IS NULL)
ORDER BY a.concluida_em IS NOT NULL, a.prazo NULLS LAST, a.criada_em;

-- name: CreateFeedback :one
INSERT INTO feedbacks (empresa_id, representante_id, gestor_id, de, ate,
    nota_planejamento, just_planejamento, nota_resultados, just_resultados,
    nota_aspectos_positivos, just_aspectos_positivos, nota_oportunidades, just_oportunidades,
    nota_pontos_melhorar, just_pontos_melhorar, nota_pendencias, just_pendencias,
    orientacao, orientacao_anterior_aplicada)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
RETURNING *;

-- name: UpdateFeedback :one
UPDATE feedbacks SET gestor_id = $3, de = $4, ate = $5,
    nota_planejamento = $6, just_planejamento = $7, nota_resultados = $8, just_resultados = $9,
    nota_aspectos_positivos = $10, just_aspectos_positivos = $11, nota_oportunidades = $12, just_oportunidades = $13,
    nota_pontos_melhorar = $14, just_pontos_melhorar = $15, nota_pendencias = $16, just_pendencias = $17,
    orientacao = $18, orientacao_anterior_aplicada = $19, atualizado_em = now()
WHERE id = $1 AND empresa_id = $2
RETURNING *;

-- name: GetFeedback :one
SELECT f.*, g.nome AS gestor_nome, r.nome AS representante_nome
FROM feedbacks f
JOIN users g ON g.id = f.gestor_id
JOIN users r ON r.id = f.representante_id
WHERE f.id = $1 AND f.empresa_id = $2
  AND (sqlc.narg('representante_id')::uuid IS NULL OR f.representante_id = sqlc.narg('representante_id'));

-- name: ListFeedbacks :many
SELECT f.id, f.representante_id, f.gestor_id, f.de, f.ate, f.orientacao, f.orientacao_anterior_aplicada,
       f.atualizado_em, g.nome AS gestor_nome, r.nome AS representante_nome,
       ((f.nota_planejamento + f.nota_resultados + f.nota_aspectos_positivos + f.nota_oportunidades
         + f.nota_pontos_melhorar + f.nota_pendencias) / 6.0)::float8 AS media
FROM feedbacks f
JOIN users g ON g.id = f.gestor_id
JOIN users r ON r.id = f.representante_id
WHERE f.empresa_id = $1
  AND (sqlc.narg('representante_id')::uuid IS NULL OR f.representante_id = sqlc.narg('representante_id'))
ORDER BY f.ate DESC, f.criado_em DESC
LIMIT 300;

-- name: FeedbackDaData :one
-- O feedback cujo período cobre esta data — é o que a tela da visita mostra.
SELECT f.id, f.de, f.ate, g.nome AS gestor_nome
FROM feedbacks f JOIN users g ON g.id = f.gestor_id
WHERE f.empresa_id = $1 AND f.representante_id = $2 AND sqlc.arg('data')::date BETWEEN f.de AND f.ate
ORDER BY f.ate DESC
LIMIT 1;

-- name: OrientacaoAnterior :one
-- A última orientação dada a este representante antes deste período — o gestor diz se ela foi aplicada.
SELECT f.id, f.orientacao, f.de, f.ate
FROM feedbacks f
WHERE f.empresa_id = $1 AND f.representante_id = $2 AND f.orientacao <> ''
  AND f.ate < sqlc.arg('de')::date
  AND (sqlc.narg('excluir_id')::uuid IS NULL OR f.id <> sqlc.narg('excluir_id'))
ORDER BY f.ate DESC, f.criado_em DESC
LIMIT 1;
