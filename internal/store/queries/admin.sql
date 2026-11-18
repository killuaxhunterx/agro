-- name: CreateEmpresa :one
INSERT INTO empresas (nome, limite_representantes) VALUES ($1, $2) RETURNING *;

-- name: UpdateEmpresaLimite :one
UPDATE empresas SET limite_representantes = $2 WHERE id = $1 RETURNING *;

-- name: EmpresaByID :one
SELECT * FROM empresas WHERE id = $1;

-- name: EmpresaByNome :one
SELECT * FROM empresas WHERE nome = $1;

-- name: ListEmpresas :many
SELECT e.*,
       (SELECT count(*) FROM users u WHERE u.empresa_id = e.id AND u.papel = 'representante' AND u.ativo)::int AS representantes_ativos,
       (SELECT count(*) FROM users u WHERE u.empresa_id = e.id AND u.papel = 'gestor' AND u.ativo)::int AS gestores_ativos
FROM empresas e
ORDER BY e.nome;

-- name: CountRepresentantesAtivos :one
SELECT count(*)::int FROM users WHERE empresa_id = $1 AND papel = 'representante' AND ativo;

-- name: LockEmpresa :one
SELECT limite_representantes FROM empresas WHERE id = $1 FOR UPDATE;

-- name: CreateUser :one
INSERT INTO users (empresa_id, nome, email, senha_hash, papel)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListUsersByEmpresa :many
SELECT * FROM users WHERE empresa_id = $1 ORDER BY papel, nome;

-- name: UserByID :one
SELECT * FROM users WHERE id = $1;

-- name: SetUserAtivo :one
UPDATE users SET ativo = $2 WHERE id = $1 RETURNING *;

-- name: SetUserSenha :exec
UPDATE users SET senha_hash = $2 WHERE id = $1;
