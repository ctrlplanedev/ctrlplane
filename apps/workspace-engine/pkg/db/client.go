package db

import (
	"context"
	"sync"
	"time"
	"workspace-engine/pkg/env"

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
		config, err := pgxpool.ParseConfig(env.Config.PostgresURL)
		if err != nil {
			log.Fatal("Failed to parse database config:", err)
		}

		config.MaxConns = int32(env.Config.PostgresMaxPoolSize)
		config.MinConns = 1
		config.HealthCheckPeriod = 30 * time.Second
		config.ConnConfig.Tracer = otelpgx.NewTracer()

		config.ConnConfig.RuntimeParams["application_name"] = env.Config.PostgresApplicationName

		pool, err = pgxpool.NewWithConfig(ctx, config)
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
