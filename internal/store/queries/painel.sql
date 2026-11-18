-- Os gráficos do painel. Todos aceitam a mesma combinação de filtros — representante,
-- região (estado do cliente), produto, cliente, ramo e período — e um filtro nulo é "todos".
-- O bloco de filtro se repete porque o sqlc não tem fragmento reutilizável.

-- name: PainelVendasMensal :many
SELECT date_trunc('month', v.data)::date AS mes,
       sum(v.valor_total_centavos)::bigint AS total_centavos,
       count(*)::int AS vendas
FROM vendas v JOIN clientes c ON c.id = v.cliente_id
WHERE v.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
  AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date
GROUP BY 1 ORDER BY 1;

-- name: PainelVendasPorRepresentante :many
SELECT u.id, u.nome, sum(v.valor_total_centavos)::bigint AS total_centavos, count(*)::int AS vendas
FROM vendas v JOIN clientes c ON c.id = v.cliente_id JOIN users u ON u.id = v.representante_id
WHERE v.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
  AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date
GROUP BY u.id, u.nome ORDER BY 3 DESC;

-- name: PainelVendasPorEstado :many
SELECT c.estado, sum(v.valor_total_centavos)::bigint AS total_centavos, count(*)::int AS vendas,
       count(DISTINCT v.representante_id)::int AS representantes
FROM vendas v JOIN clientes c ON c.id = v.cliente_id
WHERE v.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
  AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date
GROUP BY c.estado ORDER BY 2 DESC;

-- name: PainelVendasPorProduto :many
SELECT v.produto, sum(v.valor_total_centavos)::bigint AS total_centavos, count(*)::int AS vendas
FROM vendas v JOIN clientes c ON c.id = v.cliente_id
WHERE v.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
  AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date
GROUP BY v.produto ORDER BY 2 DESC;

-- name: PainelVendasPorCliente :many
SELECT c.id, c.nome, c.estado, sum(v.valor_total_centavos)::bigint AS total_centavos, count(*)::int AS vendas
FROM vendas v JOIN clientes c ON c.id = v.cliente_id
WHERE v.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR v.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR v.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
  AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date
GROUP BY c.id, c.nome, c.estado ORDER BY 4 DESC
LIMIT 15;

-- name: PainelVisitas :one
-- "planejadas" olha para a frente e ignora o período; o resto conta dentro dele.
SELECT count(*) FILTER (WHERE vi.realizada_em IS NOT NULL AND vi.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date)::int AS realizadas,
       count(*) FILTER (WHERE vi.realizada_em IS NULL AND vi.data >= current_date)::int AS planejadas,
       count(*) FILTER (WHERE vi.realizada_em IS NULL AND vi.data < current_date AND vi.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date)::int AS sem_registro,
       count(*) FILTER (WHERE vi.motivo = 'primeira_visita' AND vi.realizada_em IS NOT NULL AND vi.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date)::int AS primeiras_visitas
FROM visitas vi JOIN clientes c ON c.id = vi.cliente_id
WHERE vi.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR vi.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR vi.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'));

-- name: PainelPorRepresentante :many
-- A tabela da equipe: visitas, vendas, pendências, a média dos feedbacks cujo período toca
-- o do painel e a data do último feedback (até onde ele cobre).
SELECT u.id, u.nome,
       (SELECT count(*) FROM visitas vi JOIN clientes c ON c.id = vi.cliente_id
         WHERE vi.representante_id = u.id AND vi.realizada_em IS NOT NULL
           AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
           AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
           AND vi.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date)::int AS visitas_realizadas,
       (SELECT COALESCE(sum(v.valor_total_centavos), 0) FROM vendas v JOIN clientes c ON c.id = v.cliente_id
         WHERE v.representante_id = u.id
           AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
           AND (sqlc.narg('produto')::text IS NULL OR v.produto = sqlc.narg('produto'))
           AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
           AND v.data BETWEEN sqlc.arg('de')::date AND sqlc.arg('ate')::date)::bigint AS vendido_centavos,
       (SELECT count(*) FROM acoes a WHERE a.representante_id = u.id AND a.concluida_em IS NULL)::int AS acoes_abertas,
       (SELECT count(*) FROM acoes a WHERE a.representante_id = u.id AND a.concluida_em IS NULL AND a.prazo < current_date)::int AS acoes_atrasadas,
       COALESCE((SELECT avg((f.nota_planejamento + f.nota_resultados + f.nota_aspectos_positivos + f.nota_oportunidades
                    + f.nota_pontos_melhorar + f.nota_pendencias) / 6.0)
          FROM feedbacks f
         WHERE f.representante_id = u.id AND f.ate >= sqlc.arg('de')::date AND f.de <= sqlc.arg('ate')::date
       ), 0)::float8 AS media_feedback,
       uf.ultimo AS ultimo_feedback
FROM users u
LEFT JOIN (SELECT representante_id, max(ate) AS ultimo FROM feedbacks GROUP BY representante_id) uf
       ON uf.representante_id = u.id
WHERE u.empresa_id = sqlc.arg('empresa_id') AND u.papel = 'representante' AND u.ativo
  AND (sqlc.narg('representante_id')::uuid IS NULL OR u.id = sqlc.narg('representante_id'))
ORDER BY u.nome;

-- name: PainelAcoes :one
SELECT count(*) FILTER (WHERE a.concluida_em IS NULL)::int AS abertas,
       count(*) FILTER (WHERE a.concluida_em IS NULL AND a.prazo < current_date)::int AS atrasadas
FROM acoes a JOIN visitas vi ON vi.id = a.visita_id JOIN clientes c ON c.id = vi.cliente_id
WHERE a.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR a.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('cliente_id')::uuid IS NULL OR vi.cliente_id = sqlc.narg('cliente_id'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'));

-- name: PainelClientesSemCompra :many
-- "Descobrir tarde demais que um cliente importante não está comprando": clientes que já
-- compraram, mas não compram há mais de N dias.
SELECT c.id, c.nome, c.estado, u.nome AS representante_nome, max(v.data)::date AS ultima_compra,
       sum(v.valor_total_centavos)::bigint AS total_centavos
FROM clientes c
JOIN vendas v ON v.cliente_id = c.id
JOIN users u ON u.id = c.representante_id
WHERE c.empresa_id = sqlc.arg('empresa_id')
  AND (sqlc.narg('representante_id')::uuid IS NULL OR c.representante_id = sqlc.narg('representante_id'))
  AND (sqlc.narg('estado')::text IS NULL OR c.estado = sqlc.narg('estado'))
  AND (sqlc.narg('ramo')::text IS NULL OR c.ramo = sqlc.narg('ramo'))
GROUP BY c.id, c.nome, c.estado, u.nome
HAVING max(v.data) < current_date - sqlc.arg('dias')::int
ORDER BY sum(v.valor_total_centavos) DESC
LIMIT 10;
