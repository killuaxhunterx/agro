-- name: UserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: CreateSession :exec
INSERT INTO sessions (token_hash, user_id, expira_em) VALUES ($1, $2, $3);

-- name: UserBySession :one
SELECT u.*, e.nome AS empresa_nome
FROM sessions s
JOIN users u ON u.id = s.user_id
LEFT JOIN empresas e ON e.id = u.empresa_id
WHERE s.token_hash = $1 AND s.expira_em > now() AND u.ativo;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = $1;

-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions WHERE expira_em <= now();
