package desiredrelease_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"workspace-engine/pkg/db"
	desiredrelease "workspace-engine/svc/controllers/desiredrelease"

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

	slug := "test-dr-" + f.workspaceID.String()[:8]
	_, err := pool.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		f.workspaceID, "test_desired_release", slug)
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

	metadata, _ := json.Marshal(map[string]string{"env": "test"})
	_, err = pool.Exec(ctx,
		`INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id, config, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8::jsonb)`,
		f.resourceID, "v1", "test-resource", "Server",
		"urn:test:"+f.resourceID.String()[:8],
		f.providerID, f.workspaceID, metadata)
	require.NoError(t, err)

	t.Cleanup(func() {
		cleanCtx := context.Background()
		_, _ = pool.Exec(cleanCtx, "DELETE FROM release_variable WHERE release_id IN (SELECT id FROM release WHERE deployment_id = $1)", f.deploymentID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM release WHERE deployment_id = $1", f.deploymentID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM policy_skip WHERE version_id IN (SELECT id FROM deployment_version WHERE workspace_id = $1)", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM user_approval_record WHERE version_id IN (SELECT id FROM deployment_version WHERE workspace_id = $1)", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment_variable_value WHERE deployment_variable_id IN (SELECT id FROM deployment_variable WHERE deployment_id = $1)", f.deploymentID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment_variable WHERE deployment_id = $1", f.deploymentID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource_variable WHERE resource_id = $1", f.resourceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment_version WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM policy WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM environment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource_provider WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM workspace WHERE id = $1", f.workspaceID)
	})

	return f
}

func newReleaseTarget(f *fixture) *desiredrelease.ReleaseTarget {
	return &desiredrelease.ReleaseTarget{
		WorkspaceID:   f.workspaceID,
		DeploymentID:  f.deploymentID,
		EnvironmentID: f.environmentID,
		ResourceID:    f.resourceID,
	}
}

func TestPostgresGetter_GetCandidateVersions(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	readyID := uuid.New()
	rejectedID := uuid.New()
	buildingID := uuid.New()

	for _, tc := range []struct {
		id     uuid.UUID
		tag    string
		status string
	}{
		{readyID, "v1.0.0", "ready"},
		{rejectedID, "v0.9.0", "rejected"},
		{buildingID, "v1.1.0", "building"},
	} {
		_, err := pool.Exec(ctx,
			`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
			 VALUES ($1, $2, $3, $4, $5::deployment_version_status, $6)`,
			tc.id, tc.tag, tc.tag, f.deploymentID, tc.status, f.workspaceID)
		require.NoError(t, err, "insert version %s", tc.tag)
	}

	getter := &desiredrelease.PostgresGetter{}
	versions, err := getter.GetCandidateVersions(ctx, f.deploymentID)
	require.NoError(t, err)

	assert.Len(t, versions, 1, "only 'ready' versions should be returned")
	assert.Equal(t, readyID.String(), versions[0].Id)
	assert.Equal(t, "v1.0.0", versions[0].Tag)
}

func TestPostgresGetter_HasCurrentRelease(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := &desiredrelease.PostgresGetter{}
	rt := newReleaseTarget(f)

	has, err := getter.HasCurrentRelease(ctx, rt.ToOAPI())
	require.NoError(t, err)
	assert.False(t, has, "no releases yet")

	versionID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
		 VALUES ($1, $2, $3, $4, 'ready', $5)`,
		versionID, "v1", "v1", f.deploymentID, f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO release (id, resource_id, environment_id, deployment_id, version_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		uuid.New(), f.resourceID, f.environmentID, f.deploymentID, versionID)
	require.NoError(t, err)

	has, err = getter.HasCurrentRelease(ctx, rt.ToOAPI())
	require.NoError(t, err)
	assert.True(t, has)
}

func TestPostgresGetter_GetCurrentRelease(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := &desiredrelease.PostgresGetter{}
	rt := newReleaseTarget(f)

	release, err := getter.GetCurrentRelease(ctx, rt)
	require.NoError(t, err)
	assert.Nil(t, release, "no releases yet")

	versionID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
		 VALUES ($1, $2, $3, $4, 'ready', $5)`,
		versionID, "v1", "v1", f.deploymentID, f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO release (id, resource_id, environment_id, deployment_id, version_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		uuid.New(), f.resourceID, f.environmentID, f.deploymentID, versionID)
	require.NoError(t, err)

	release, err = getter.GetCurrentRelease(ctx, rt)
	require.NoError(t, err)
	require.NotNil(t, release)
	assert.Equal(t, versionID.String(), release.Version.Id)
	assert.Equal(t, f.deploymentID.String(), release.ReleaseTarget.DeploymentId)
}

func TestPostgresGetter_GetDeploymentVariables(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	varID := uuid.New()
	defaultVal, _ := json.Marshal("default-value")
	_, err := pool.Exec(ctx,
		`INSERT INTO deployment_variable (id, deployment_id, key, description, default_value)
		 VALUES ($1, $2, $3, $4, $5)`,
		varID, f.deploymentID, "IMAGE_TAG", "The image tag", defaultVal)
	require.NoError(t, err)

	valID := uuid.New()
	valData, _ := json.Marshal("override-value")
	_, err = pool.Exec(ctx,
		`INSERT INTO deployment_variable_value (id, deployment_variable_id, value, resource_selector, priority)
		 VALUES ($1, $2, $3, $4, $5)`,
		valID, varID, valData, `resource.kind == "Server"`, int64(10))
	require.NoError(t, err)

	getter := &desiredrelease.PostgresGetter{}
	vars, err := getter.GetDeploymentVariables(ctx, f.deploymentID.String())
	require.NoError(t, err)

	assert.Len(t, vars, 1)
	assert.Equal(t, "IMAGE_TAG", vars[0].Variable.Key)
	assert.Equal(t, f.deploymentID.String(), vars[0].Variable.DeploymentId)
	require.NotNil(t, vars[0].Variable.DefaultValue)

	desc := "The image tag"
	assert.Equal(t, &desc, vars[0].Variable.Description)

	assert.Len(t, vars[0].Values, 1)
	assert.Equal(t, int64(10), vars[0].Values[0].Priority)
	assert.NotNil(t, vars[0].Values[0].ResourceSelector)
}

func TestPostgresGetter_GetResourceVariables(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	valData, _ := json.Marshal("my-resource-value")
	_, err := pool.Exec(ctx,
		`INSERT INTO resource_variable (resource_id, key, value) VALUES ($1, $2, $3)`,
		f.resourceID, "REGION", valData)
	require.NoError(t, err)

	getter := &desiredrelease.PostgresGetter{}
	vars, err := getter.GetResourceVariables(ctx, f.resourceID.String())
	require.NoError(t, err)

	assert.Len(t, vars, 1)
	rv, ok := vars["REGION"]
	require.True(t, ok)
	assert.Equal(t, f.resourceID.String(), rv.ResourceId)
	assert.Equal(t, "REGION", rv.Key)
}

func TestPostgresGetter_GetPolicySkips(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	versionID := uuid.New()
	_, err := pool.Exec(ctx,
		`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
		 VALUES ($1, $2, $3, $4, 'ready', $5)`,
		versionID, "v1", "v1", f.deploymentID, f.workspaceID)
	require.NoError(t, err)

	ruleID := uuid.New()
	skipID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO policy_skip (id, version_id, rule_id, environment_id, resource_id, reason, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		skipID, versionID, ruleID, f.environmentID, f.resourceID, "emergency deploy", "user-1")
	require.NoError(t, err)

	getter := &desiredrelease.PostgresGetter{}
	skips, err := getter.GetPolicySkips(ctx, versionID.String(), f.environmentID.String(), f.resourceID.String())
	require.NoError(t, err)

	assert.Len(t, skips, 1)
	assert.Equal(t, skipID.String(), skips[0].Id)
	assert.Equal(t, "emergency deploy", skips[0].Reason)
	assert.Equal(t, "user-1", skips[0].CreatedBy)
	assert.Equal(t, ruleID.String(), skips[0].RuleId)

	t.Run("null environment matches any environment", func(t *testing.T) {
		globalSkipID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO policy_skip (id, version_id, rule_id, environment_id, resource_id, reason, created_by)
			 VALUES ($1, $2, $3, NULL, NULL, $4, $5)`,
			globalSkipID, versionID, uuid.New(), "global skip", "admin")
		require.NoError(t, err)

		skips, err := getter.GetPolicySkips(ctx, versionID.String(), f.environmentID.String(), f.resourceID.String())
		require.NoError(t, err)
		assert.Len(t, skips, 2, "should include both targeted and global skip")
	})
}

func TestPostgresGetter_GetApprovalRecords(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	versionID := uuid.New()
	_, err := pool.Exec(ctx,
		`INSERT INTO deployment_version (id, name, tag, deployment_id, status, workspace_id)
		 VALUES ($1, $2, $3, $4, 'ready', $5)`,
		versionID, "v1", "v1", f.deploymentID, f.workspaceID)
	require.NoError(t, err)

	userID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO user_approval_record (version_id, user_id, environment_id, status, reason)
		 VALUES ($1, $2, $3, $4, $5)`,
		versionID, userID, f.environmentID, "approved", "looks good")
	require.NoError(t, err)

	getter := &desiredrelease.PostgresGetter{}
	records, err := getter.GetApprovalRecords(ctx, versionID.String(), f.environmentID.String())
	require.NoError(t, err)

	assert.Len(t, records, 1)
	assert.Equal(t, versionID.String(), records[0].VersionId)
	assert.Equal(t, userID.String(), records[0].UserId)
	reason := "looks good"
	assert.Equal(t, &reason, records[0].Reason)
}

func TestPostgresGetter_ReleaseTargetExists(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := &desiredrelease.PostgresGetter{}
	rt := newReleaseTarget(f)

	exists, err := getter.ReleaseTargetExists(ctx, rt)
	require.NoError(t, err)
	assert.False(t, exists, "no release target row yet")
}
