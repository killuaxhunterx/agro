// Command agro serves the API and runs the operator commands.
//
//	agro                                   # HTTP server
//	agro migrate up|down|status
//	agro master criar <email> <nome> <senha>
//	agro demo                              # empresa de demonstração com dados fictícios
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/knowrisk/agro/internal/admin"
	"github.com/knowrisk/agro/internal/auth"
	"github.com/knowrisk/agro/internal/comercial"
	"github.com/knowrisk/agro/internal/server"
)

type config struct {
	databaseURL  string
	port         string
	logFormat    string
	cookieSecure bool
	staticDir    string
	openAIAPIKey string
}

func loadConfig() (config, error) {
	c := config{
		databaseURL:  os.Getenv("DATABASE_URL"),
		port:         envOr("PORT", "8080"),
		logFormat:    envOr("LOG_FORMAT", "json"),
		cookieSecure: os.Getenv("COOKIE_SECURE") != "false",
		staticDir:    os.Getenv("STATIC_DIR"),
		openAIAPIKey: os.Getenv("OPENAI_API_KEY"),
	}
	if c.databaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	return c, nil
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}
	var h slog.Handler = slog.NewJSONHandler(os.Stdout, nil)
	if cfg.logFormat == "text" {
		h = slog.NewTextHandler(os.Stdout, nil)
	}
	logger := slog.New(h)
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, cfg, logger, os.Args[1:]); err != nil {
		logger.Error("exit", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, cfg config, logger *slog.Logger, args []string) error {
	if len(args) > 0 && args[0] == "migrate" {
		return runMigrate(ctx, cfg.databaseURL, args[1:])
	}

	pool, err := pgxpool.New(ctx, cfg.databaseURL)
	if err != nil {
		return fmt.Errorf("open pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	authService := auth.New(pool)
	adminService := admin.New(pool)
	comercialService := comercial.New(pool)

	if len(args) > 0 {
		switch args[0] {
		case "master":
			return runMaster(ctx, adminService, args[1:])
		case "demo":
			return runDemo(ctx, pool, adminService, comercialService)
		default:
			return fmt.Errorf("unknown command %q: expected none, migrate, master or demo", args[0])
		}
	}

	if n, err := authService.CleanupExpiredSessions(ctx); err != nil {
		logger.ErrorContext(ctx, "cleanup sessions", "error", err)
	} else {
		logger.InfoContext(ctx, "cleanup sessions", "removed", n)
	}

	srv := &http.Server{
		Addr: ":" + cfg.port,
		Handler: server.New(authService, adminService, comercialService, logger, server.Config{
			CookieSecure: cfg.cookieSecure,
			StaticDir:    cfg.staticDir,
			Transcritor:  newTranscritor(cfg),
		}).Handler(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		logger.Info("server listening", "port", cfg.port, "transcricao", cfg.openAIAPIKey != "", "static", cfg.staticDir)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
	}()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdown)
}

func runMaster(ctx context.Context, ad *admin.Service, args []string) error {
	if len(args) != 4 || args[0] != "criar" {
		return errors.New("usage: agro master criar <email> <nome> <senha>")
	}
	u, err := ad.CreateUser(ctx, admin.NovoUsuario{Email: args[1], Nome: args[2], Senha: args[3], Papel: "master"})
	if err != nil {
		return err
	}
	fmt.Println(u.ID)
	return nil
}
