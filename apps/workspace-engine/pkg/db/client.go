package db

import (
	"context"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

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
		config, err := pgxpool.ParseConfig(os.Getenv("POSTGRES_URL"))
		if err != nil {
			log.Fatal("Failed to parse database config:", err)
		}

		if maxConns := os.Getenv("POSTGRES_MAX_POOL_SIZE"); maxConns != "" {
			if max, err := strconv.Atoi(maxConns); err == nil {
				config.MaxConns = int32(max)
			}
		}

		config.MinConns = 1
		config.HealthCheckPeriod = 30 * time.Second
		config.ConnConfig.Tracer = otelpgx.NewTracer()

		if appName := os.Getenv("POSTGRES_APPLICATION_NAME"); appName != "" {
			config.ConnConfig.RuntimeParams["application_name"] = appName
		}

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
