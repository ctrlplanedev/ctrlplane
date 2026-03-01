package harness

import (
	"context"
	"os"
	"testing"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/memory"
	pgqueue "workspace-engine/pkg/reconcile/postgres"

	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultTestPostgresURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

// UseDBBacking returns true when the USE_DATABASE_BACKING environment
// variable is set. When enabled, NewTestPipeline uses a real PostgreSQL
// reconcile queue instead of the in-memory implementation.
//
// Run tests with DB backing:
//
//	USE_DATABASE_BACKING=1 go test ./test/controllers/...
//
// Optionally set POSTGRES_URL (defaults to postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane):
//
//	USE_DATABASE_BACKING=1 POSTGRES_URL=postgresql://... go test ./test/controllers/...
func UseDBBacking() bool {
	return os.Getenv("USE_DATABASE_BACKING") != ""
}

// requireDB ensures a PostgreSQL database is reachable, skipping the test
// if it is not.
func requireDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	if os.Getenv("POSTGRES_URL") == "" {
		os.Setenv("POSTGRES_URL", defaultTestPostgresURL)
	}

	ctx := context.Background()
	pool := db.GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database not available at %s: %v", os.Getenv("POSTGRES_URL"), err)
	}
	return pool
}

// queueSet holds the queue handles needed by the pipeline.
type queueSet struct {
	shared           reconcile.Queue
	selectorQueue    reconcile.Queue
	releaseQueue     reconcile.Queue
	jobDispatchQueue reconcile.Queue
}

// newMemoryQueues creates the in-memory queue set.
func newMemoryQueues() queueSet {
	shared := memory.New()
	return queueSet{
		shared:           shared,
		selectorQueue:    shared.ForKinds(KindSelectorEval),
		releaseQueue:     shared.ForKinds(KindDesiredRelease),
		jobDispatchQueue: shared.ForKinds(KindJobDispatch),
	}
}

// newPostgresQueues creates a Postgres-backed queue set and registers
// cleanup to remove any leftover work items for the given workspace.
func newPostgresQueues(t *testing.T, pool *pgxpool.Pool, workspaceID string) queueSet {
	t.Helper()

	shared := pgqueue.New(pool)
	selectorQueue := pgqueue.NewForKinds(pool, KindSelectorEval)
	releaseQueue := pgqueue.NewForKinds(pool, KindDesiredRelease)

	t.Cleanup(func() {
		ctx := context.Background()
		cleanupSQL := `DELETE FROM reconcile_work_scope WHERE workspace_id = $1`
		if _, err := pool.Exec(ctx, cleanupSQL, workspaceID); err != nil {
			t.Logf("Cleanup: failed to delete reconcile work items for workspace %s: %v", workspaceID, err)
		}
	})

	jobDispatchQueue := pgqueue.NewForKinds(pool, KindJobDispatch)

	return queueSet{
		shared:           shared,
		selectorQueue:    selectorQueue,
		releaseQueue:     releaseQueue,
		jobDispatchQueue: jobDispatchQueue,
	}
}
