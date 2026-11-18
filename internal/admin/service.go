// Package admin is the master's side: empresas, their users, and the contracted limit of
// representantes. Only the master reaches it — the route says so, not an if here.
package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/knowrisk/agro/internal/auth"
	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

type Service struct {
	pool *pgxpool.Pool
	q    *sqlc.Queries
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: sqlc.New(pool)}
}

func (s *Service) ListEmpresas(ctx context.Context) ([]sqlc.ListEmpresasRow, error) {
	return s.q.ListEmpresas(ctx)
}

func (s *Service) Empresa(ctx context.Context, id uuid.UUID) (sqlc.Empresa, error) {
	e, err := s.q.EmpresaByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return e, domain.ErrNotFound
	}
	return e, err
}

func (s *Service) CreateEmpresa(ctx context.Context, nome string, limite int) (sqlc.Empresa, error) {
	nome = strings.TrimSpace(nome)
	if nome == "" {
		return sqlc.Empresa{}, domain.Invalid("Informe o nome da empresa.")
	}
	if limite < 0 {
		return sqlc.Empresa{}, domain.Invalid("O limite de representantes não pode ser negativo.")
	}
	e, err := s.q.CreateEmpresa(ctx, sqlc.CreateEmpresaParams{Nome: nome, LimiteRepresentantes: int32(limite)})
	if isUnique(err) {
		return e, domain.Invalid("Já existe uma empresa com esse nome.")
	}
	return e, err
}

// SetLimite changes the contracted number of representantes. It may go below the number
// already active: nobody is deactivated, the empresa just cannot add another until it is
// back under the limit.
func (s *Service) SetLimite(ctx context.Context, id uuid.UUID, limite int) (sqlc.Empresa, error) {
	if limite < 0 {
		return sqlc.Empresa{}, domain.Invalid("O limite de representantes não pode ser negativo.")
	}
	e, err := s.q.UpdateEmpresaLimite(ctx, sqlc.UpdateEmpresaLimiteParams{ID: id, LimiteRepresentantes: int32(limite)})
	if errors.Is(err, pgx.ErrNoRows) {
		return e, domain.ErrNotFound
	}
	return e, err
}

func (s *Service) ListUsers(ctx context.Context, empresaID uuid.UUID) ([]sqlc.User, error) {
	return s.q.ListUsersByEmpresa(ctx, &empresaID)
}

type NovoUsuario struct {
	EmpresaID *uuid.UUID // nil only for master
	Nome      string
	Email     string
	Senha     string
	Papel     domain.Papel
}

// CreateUser adds an account with a temporary password the master hands over. A new
// representante counts against the limit; the empresa row is locked so two simultaneous
// additions cannot both squeeze under it.
func (s *Service) CreateUser(ctx context.Context, n NovoUsuario) (sqlc.User, error) {
	n.Nome = strings.TrimSpace(n.Nome)
	n.Email = strings.ToLower(strings.TrimSpace(n.Email))
	switch {
	case n.Nome == "":
		return sqlc.User{}, domain.Invalid("Informe o nome.")
	case !strings.Contains(n.Email, "@"):
		return sqlc.User{}, domain.Invalid("Informe um e-mail válido.")
	case !n.Papel.Valid():
		return sqlc.User{}, domain.Invalid("Papel inválido.")
	case (n.Papel == domain.PapelMaster) != (n.EmpresaID == nil):
		return sqlc.User{}, domain.Invalid("Só o master fica fora de uma empresa.")
	}
	if err := auth.CheckPassword(n.Senha, n.Email, n.Nome); err != nil {
		return sqlc.User{}, auth.PasswordError(err)
	}
	hash, err := auth.HashPassword(n.Senha)
	if err != nil {
		return sqlc.User{}, err
	}

	var created sqlc.User
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if n.Papel == domain.PapelRepresentante {
			if err := checkLimite(ctx, q, *n.EmpresaID); err != nil {
				return err
			}
		}
		u, err := q.CreateUser(ctx, sqlc.CreateUserParams{
			EmpresaID: n.EmpresaID, Nome: n.Nome, Email: n.Email, SenhaHash: hash, Papel: string(n.Papel),
		})
		created = u
		return err
	})
	if isUnique(err) {
		return created, domain.ErrEmailEmUso
	}
	return created, err
}

// SetAtivo deactivates (or reactivates) an account. Deactivating ends its sessions; its
// records stay with the empresa — the history does not leave with the person.
func (s *Service) SetAtivo(ctx context.Context, empresaID, userID uuid.UUID, ativo bool) (sqlc.User, error) {
	var out sqlc.User
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		u, err := q.UserByID(ctx, userID)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && (u.EmpresaID == nil || *u.EmpresaID != empresaID)) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		if ativo && !u.Ativo && u.Papel == string(domain.PapelRepresentante) {
			if err := checkLimite(ctx, q, empresaID); err != nil {
				return err
			}
		}
		if out, err = q.SetUserAtivo(ctx, sqlc.SetUserAtivoParams{ID: userID, Ativo: ativo}); err != nil {
			return err
		}
		if !ativo {
			return q.DeleteUserSessions(ctx, userID)
		}
		return nil
	})
	return out, err
}

func checkLimite(ctx context.Context, q *sqlc.Queries, empresaID uuid.UUID) error {
	limite, err := q.LockEmpresa(ctx, empresaID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock empresa: %w", err)
	}
	ativos, err := q.CountRepresentantesAtivos(ctx, &empresaID)
	if err != nil {
		return fmt.Errorf("count representantes: %w", err)
	}
	if ativos >= limite {
		return domain.ErrLimite
	}
	return nil
}

func isUnique(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}
