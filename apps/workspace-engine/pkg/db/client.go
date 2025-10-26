package db

import (
	"context"
	"sync"
	"time"
	"workspace-engine/pkg/config"

	"github.com/charmbracelet/log"
	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool *pgxpool.Pool
	once sync.Once
)

// GetPool returns the singleton database connection pool
func GetPool(ctx context.Context) *pgxpool.Pool {
	once.Do(func() {
		cfg, err := pgxpool.ParseConfig(config.Global.PostgresURL)
		if err != nil {
			log.Fatal("Failed to parse database config:", err)
		}

		cfg.MaxConns = int32(config.Global.PostgresMaxPoolSize)
		cfg.MinConns = 1
		cfg.HealthCheckPeriod = 30 * time.Second
		cfg.ConnConfig.Tracer = otelpgx.NewTracer()

		cfg.ConnConfig.RuntimeParams["application_name"] = config.Global.PostgresApplicationName

		pool, err = pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			log.Fatal("Failed to create database pool:", err)
		}
	})
	return pool
}

// GetDB returns a connection from the pool (similar to your TS db export)
func GetDB(ctx context.Context) (*pgxpool.Conn, error) {
	if pool == nil {
		GetPool(ctx)
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

// Close closes the connection pool (useful for cleanup)
func Close() {
	if pool != nil {
		pool.Close()
	}
}
