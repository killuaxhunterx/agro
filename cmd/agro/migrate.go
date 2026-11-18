package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"text/tabwriter"

	// goose speaks database/sql, so the pool used by the server is not reusable here.
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/knowrisk/agro/migrations"
)

// runMigrate implements `agro migrate <up|down|status>`. There is no goose CLI in this
// project: the binary drags in every dialect goose supports, for a Postgres-only product.
func runMigrate(ctx context.Context, databaseURL string, args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("migrate: expected exactly one of up, down, status")
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	// Out-of-order exists so parallel branches merge without renumbering. It does not
	// excuse gaps — `make migrate-verify` still refuses those.
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS,
		goose.WithAllowOutofOrder(true))
	if err != nil {
		return fmt.Errorf("build migration provider: %w", err)
	}

	switch args[0] {
	case "up":
		results, err := provider.Up(ctx)
		if err != nil {
			return fmt.Errorf("migrate up: %w", err)
		}
		if len(results) == 0 {
			fmt.Println("no pending migrations")
			return nil
		}
		for _, r := range results {
			fmt.Printf("applied %d %s (%s)\n", r.Source.Version, r.Source.Path, r.Duration)
		}
		return nil

	case "down":
		result, err := provider.Down(ctx)
		if err != nil {
			return fmt.Errorf("migrate down: %w", err)
		}
		fmt.Printf("rolled back %d %s (%s)\n", result.Source.Version, result.Source.Path, result.Duration)
		return nil

	case "status":
		statuses, err := provider.Status(ctx)
		if err != nil {
			return fmt.Errorf("migrate status: %w", err)
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "VERSION\tSTATE\tAPPLIED AT")
		for _, s := range statuses {
			appliedAt := "-"
			if !s.AppliedAt.IsZero() {
				appliedAt = s.AppliedAt.Format("2006-01-02 15:04:05")
			}
			fmt.Fprintf(w, "%d\t%s\t%s\n", s.Source.Version, s.State, appliedAt)
		}
		return w.Flush()

	default:
		return fmt.Errorf("migrate: unknown command %q: expected up, down or status", args[0])
	}
}
