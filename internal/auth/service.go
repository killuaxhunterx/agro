package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/knowrisk/agro/internal/domain"
	"github.com/knowrisk/agro/internal/store/sqlc"
)

// SessionTTL is how long a sign-in lasts. Long on purpose: the representante signs in on
// the phone once and fills reports from the road for weeks.
const SessionTTL = 30 * 24 * time.Hour

// dummyHash makes a sign-in for an unknown e-mail cost the same argon2id work as a wrong
// password, so the response time does not reveal which e-mails exist.
var dummyHash, _ = HashPassword("dummy-password-for-timing")

type Service struct {
	q *sqlc.Queries
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{q: sqlc.New(pool)}
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// SignIn checks the credentials and opens a session; the token goes in the cookie and
// only its hash is stored.
func (s *Service) SignIn(ctx context.Context, email, senha string) (string, domain.User, error) {
	u, err := s.q.UserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if errors.Is(err, pgx.ErrNoRows) {
		VerifyPassword(dummyHash, senha)
		return "", domain.User{}, domain.ErrCredenciais
	}
	if err != nil {
		return "", domain.User{}, fmt.Errorf("user by email: %w", err)
	}
	if !VerifyPassword(u.SenhaHash, senha) || !u.Ativo {
		return "", domain.User{}, domain.ErrCredenciais
	}

	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	token := base64.RawURLEncoding.EncodeToString(raw)
	if err := s.q.CreateSession(ctx, sqlc.CreateSessionParams{
		TokenHash: hashToken(token),
		UserID:    u.ID,
		ExpiraEm:  time.Now().Add(SessionTTL),
	}); err != nil {
		return "", domain.User{}, fmt.Errorf("create session: %w", err)
	}
	user, err := s.UserBySession(ctx, token)
	return token, user, err
}

// UserBySession resolves a cookie token. Any failure is domain.ErrCredenciais.
func (s *Service) UserBySession(ctx context.Context, token string) (domain.User, error) {
	row, err := s.q.UserBySession(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrCredenciais
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("user by session: %w", err)
	}
	u := domain.User{ID: row.ID, Nome: row.Nome, Email: row.Email, Papel: domain.Papel(row.Papel)}
	if row.EmpresaID != nil {
		u.EmpresaID = *row.EmpresaID
	}
	if row.EmpresaNome != nil {
		u.EmpresaNome = *row.EmpresaNome
	}
	return u, nil
}

func (s *Service) SignOut(ctx context.Context, token string) error {
	return s.q.DeleteSession(ctx, hashToken(token))
}

// ChangePassword lets anyone signed in replace their own password (the master hands out a
// temporary one when creating the account).
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, atual, nova string) error {
	u, err := s.q.UserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user by id: %w", err)
	}
	if !VerifyPassword(u.SenhaHash, atual) {
		return domain.Invalid("A senha atual não confere.")
	}
	if err := CheckPassword(nova, u.Email, u.Nome); err != nil {
		return passwordError(err)
	}
	hash, err := HashPassword(nova)
	if err != nil {
		return err
	}
	return s.q.SetUserSenha(ctx, sqlc.SetUserSenhaParams{ID: userID, SenhaHash: hash})
}

func (s *Service) CleanupExpiredSessions(ctx context.Context) (int64, error) {
	return s.q.DeleteExpiredSessions(ctx)
}

// passwordError turns CheckPassword's sentinels into screen copy.
func passwordError(err error) error {
	switch {
	case errors.Is(err, ErrPasswordTooShort):
		return domain.Invalid(fmt.Sprintf("A senha precisa ter pelo menos %d caracteres.", MinPasswordLength))
	case errors.Is(err, ErrPasswordTooCommon):
		return domain.Invalid("Escolha uma senha menos óbvia.")
	}
	return err
}

// PasswordError is exported for internal/admin, which validates the temporary password.
func PasswordError(err error) error { return passwordError(err) }
