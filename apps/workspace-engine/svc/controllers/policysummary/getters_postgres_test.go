package policysummary_test

import (
	"context"
	"os"
	"testing"

	"workspace-engine/pkg/db"
	"workspace-engine/svc/controllers/policysummary"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const defaultDBURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

func requireTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if os.Getenv("USE_DATABASE_BACKING") == "" {
		t.Skip("Skipping: set USE_DATABASE_BACKING=1 to run DB-backed tests")
	}
	if os.Getenv("POSTGRES_URL") == "" {
		os.Setenv("POSTGRES_URL", defaultDBURL)
	}
	ctx := context.Background()
	pool := db.GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database not available: %v", err)
	}
	return pool
}

type fixture struct {
	pool          *pgxpool.Pool
	workspaceID   uuid.UUID
	deploymentID  uuid.UUID
	environmentID uuid.UUID
	resourceID    uuid.UUID
	providerID    uuid.UUID
}

func setupFixture(t *testing.T, pool *pgxpool.Pool) *fixture {
	t.Helper()
	ctx := context.Background()

	f := &fixture{
		pool:          pool,
		workspaceID:   uuid.New(),
		deploymentID:  uuid.New(),
		environmentID: uuid.New(),
		resourceID:    uuid.New(),
		providerID:    uuid.New(),
	}

	slug := "test-ps-" + f.workspaceID.String()[:8]
	_, err := pool.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		f.workspaceID, "test_policy_summary", slug)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		"INSERT INTO resource_provider (id, name, workspace_id) VALUES ($1, $2, $3)",
		f.providerID, "test-provider", f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO deployment (id, name, description, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		f.deploymentID, "test-deploy", "", "true", f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO environment (id, name, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4)`,
		f.environmentID, "test-env", "true", f.workspaceID)
	require.NoError(t, err)

	t.Cleanup(func() {
		cleanCtx := context.Background()
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment_version WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM policy WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM environment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource_provider WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM workspace WHERE id = $1", f.workspaceID)
	})

	return f
}

func TestPostgresGetter_GetEnvironment(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	env, err := getter.GetEnvironment(ctx, f.environmentID.String())
	require.NoError(t, err)
	require.NotNil(t, env)
	assert.Equal(t, f.environmentID.String(), env.Id)
	assert.Equal(t, "test-env", env.Name)
}

func TestPostgresGetter_GetEnvironment_NotFound(t *testing.T) {
	pool := requireTestDB(t)
	_ = setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	_, err := getter.GetEnvironment(ctx, uuid.New().String())
	assert.Error(t, err)
}

func TestPostgresGetter_GetDeployment(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	dep, err := getter.GetDeployment(ctx, f.deploymentID.String())
	require.NoError(t, err)
	require.NotNil(t, dep)
	assert.Equal(t, f.deploymentID.String(), dep.Id)
	assert.Equal(t, "test-deploy", dep.Name)
}

func TestPostgresGetter_GetDeployment_NotFound(t *testing.T) {
	pool := requireTestDB(t)
	_ = setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	_, err := getter.GetDeployment(ctx, uuid.New().String())
	assert.Error(t, err)
}

func TestPostgresGetter_GetVersion(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	versionID := uuid.New()
	_, err := pool.Exec(ctx,
		`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
		 VALUES ($1, $2, $3, $4, 'ready', $5)`,
		versionID, "v1.0.0", "v1.0.0", f.deploymentID, f.workspaceID)
	require.NoError(t, err)

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	ver, err := getter.GetVersion(ctx, versionID)
	require.NoError(t, err)
	require.NotNil(t, ver)
	assert.Equal(t, versionID.String(), ver.Id)
	assert.Equal(t, "v1.0.0", ver.Tag)
}

func TestPostgresGetter_GetVersion_NotFound(t *testing.T) {
	pool := requireTestDB(t)
	_ = setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	_, err := getter.GetVersion(ctx, uuid.New())
	assert.Error(t, err)
}

func TestPostgresGetter_GetPoliciesForEnvironment(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	policyID := uuid.New()
	_, err := pool.Exec(ctx,
		`INSERT INTO policy (id, name, selector, priority, enabled, workspace_id)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		policyID, "test-policy", "true", 10, true, f.workspaceID)
	require.NoError(t, err)

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	policies, err := getter.GetPoliciesForEnvironment(ctx, f.workspaceID, f.environmentID)
	require.NoError(t, err)
	require.Len(t, policies, 1)
	assert.Equal(t, policyID.String(), policies[0].Id)
	assert.Equal(t, "test-policy", policies[0].Name)
}

func TestPostgresGetter_GetPoliciesForDeployment(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	policyID := uuid.New()
	_, err := pool.Exec(ctx,
		`INSERT INTO policy (id, name, selector, priority, enabled, workspace_id)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		policyID, "dep-policy", "true", 5, true, f.workspaceID)
	require.NoError(t, err)

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	policies, err := getter.GetPoliciesForDeployment(ctx, f.workspaceID, f.deploymentID)
	require.NoError(t, err)
	require.Len(t, policies, 1)
	assert.Equal(t, policyID.String(), policies[0].Id)
}

func TestPostgresGetter_GetPoliciesEmpty(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	queries := db.New(pool)
	getter := policysummary.NewPostgresGetter(queries)

	policies, err := getter.GetPoliciesForEnvironment(ctx, f.workspaceID, f.environmentID)
	require.NoError(t, err)
	assert.Empty(t, policies)
}
