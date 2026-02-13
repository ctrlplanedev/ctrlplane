package integration

import (
	"context"
	"os"
	"testing"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
	"workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

const defaultTestPostgresURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

// requireDB ensures a PostgreSQL database is reachable, skipping the test
// if it is not. It also sets the default POSTGRES_URL when the env var is
// unset so that db.GetPool picks up a sensible default.
func requireDB(t *testing.T) {
	t.Helper()

	if os.Getenv("POSTGRES_URL") == "" {
		os.Setenv("POSTGRES_URL", defaultTestPostgresURL)
	}

	ctx := context.Background()
	pool := db.GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database not available at %s: %v", os.Getenv("POSTGRES_URL"), err)
	}
}

// newDBTestWorkspace is the DB-backed counterpart of newMemoryTestWorkspace.
// It is called automatically by NewTestWorkspace when USE_DATABASE_BACKING is
// set. The function:
//
//  1. Verifies the database is reachable (skips otherwise).
//  2. Creates a workspace row in the database with a real UUID.
//  3. Constructs the workspace with DB-backed deployment versions.
//  4. Registers the workspace in the global manager so HTTP handlers can
//     resolve it.
//  5. Registers cleanup to delete the DB row and remove the workspace from
//     the manager when the test finishes.
func newDBTestWorkspace(t *testing.T, options ...WorkspaceOption) *TestWorkspace {
	t.Helper()
	requireDB(t)

	ctx := context.Background()
	workspaceID := uuid.New().String()

	conn, err := db.GetDB(ctx)
	if err != nil {
		t.Fatalf("failed to get DB connection: %v", err)
	}
	defer conn.Release()

	_, err = conn.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		workspaceID, "test_"+workspaceID[:8], "test-"+workspaceID[:8])
	if err != nil {
		t.Fatalf("failed to create test workspace in DB: %v", err)
	}

	traceStore := spanstore.NewInMemoryStore()

	ws := workspace.New(ctx, workspaceID,
		workspace.WithTraceStore(traceStore),
		workspace.WithStoreOptions(
			store.WithDBSystems(ctx),
			store.WithDBDeployments(ctx),
			store.WithDBEnvironments(ctx),
			store.WithDBDeploymentVersions(ctx),
		),
	)

	manager.Workspaces().Set(workspaceID, ws)

	t.Cleanup(func() {
		manager.Workspaces().Remove(workspaceID)

		cleanupConn, err := db.GetDB(context.Background())
		if err != nil {
			t.Logf("Cleanup: failed to get DB connection: %v", err)
			return
		}
		defer cleanupConn.Release()

		// Delete deployment_version rows first — the workspace_id FK has no
		// ON DELETE CASCADE, so removing the workspace without this would fail.
		_, err = cleanupConn.Exec(context.Background(),
			"DELETE FROM deployment_version WHERE workspace_id = $1", workspaceID)
		if err != nil {
			t.Logf("Cleanup: failed to delete deployment versions for workspace %s: %v", workspaceID, err)
		}

		_, err = cleanupConn.Exec(context.Background(),
			"DELETE FROM workspace WHERE id = $1", workspaceID)
		if err != nil {
			t.Logf("Cleanup: failed to delete workspace %s: %v", workspaceID, err)
		}
	})

	tw := &TestWorkspace{
		t:             t,
		workspace:     ws,
		eventListener: events.NewEventHandler(),
		traceStore:    traceStore,
	}

	for _, option := range options {
		if err := option(tw); err != nil {
			t.Fatalf("failed to apply option: %v", err)
		}
	}

	return tw
}
