package desiredrelease_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/db"
	desiredrelease "workspace-engine/svc/controllers/desiredrelease"
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
	_, err = pool.Exec(
		ctx,
		`INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id, config, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8::jsonb)`,
		f.resourceID,
		"v1",
		"test-resource",
		"Server",
		"urn:test:"+f.resourceID.String()[:8],
		f.providerID,
		f.workspaceID,
		metadata,
	)
	require.NoError(t, err)

	t.Cleanup(func() {
		cleanCtx := context.Background()
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM release_variable WHERE release_id IN (SELECT id FROM release WHERE deployment_id = $1)",
			f.deploymentID,
		)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM release WHERE deployment_id = $1", f.deploymentID)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM policy_skip WHERE version_id IN (SELECT id FROM deployment_version WHERE workspace_id = $1)",
			f.workspaceID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM user_approval_record WHERE version_id IN (SELECT id FROM deployment_version WHERE workspace_id = $1)",
			f.workspaceID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM deployment_variable_value WHERE deployment_variable_id IN (SELECT id FROM deployment_variable WHERE deployment_id = $1)",
			f.deploymentID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM deployment_variable WHERE deployment_id = $1",
			f.deploymentID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM resource_variable WHERE resource_id = $1",
			f.resourceID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM deployment_version WHERE workspace_id = $1",
			f.workspaceID,
		)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM policy WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM deployment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM environment WHERE workspace_id = $1", f.workspaceID)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM resource_provider WHERE workspace_id = $1",
			f.workspaceID,
		)
		_, _ = pool.Exec(cleanCtx, "DELETE FROM workspace WHERE id = $1", f.workspaceID)
	})

	return f
}

// newGetter constructs a PostgresGetter with its embedded interfaces properly
// initialized. A *db.Queries is required because some promoted methods
// (HasCurrentRelease, GetDeploymentVariables, GetResourceVariables) use the
// queries instance they were constructed with rather than db.GetQueries(ctx).
// The store dependencies (release targets, policies, jobs) are nil because
// none of the methods under test reach them.
func newGetter(pool *pgxpool.Pool) *desiredrelease.PostgresGetter {
	return desiredrelease.NewPostgresGetter(db.New(pool), nil, nil, nil, nil)
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

	getter := newGetter(pool)

	t.Run("returns empty slice when no versions exist", func(t *testing.T) {
		versions, err := getter.GetCandidateVersions(ctx, f.deploymentID)
		require.NoError(t, err)
		assert.NotNil(t, versions, "should return empty slice, not nil")
		assert.Empty(t, versions)
	})

	t.Run("returns only ready versions", func(t *testing.T) {
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

		versions, err := getter.GetCandidateVersions(ctx, f.deploymentID)
		require.NoError(t, err)

		assert.Len(t, versions, 1, "only 'ready' versions should be returned")
		assert.Equal(t, readyID.String(), versions[0].Id)
		assert.Equal(t, "v1.0.0", versions[0].Tag)
	})

	t.Run("returns empty slice for nonexistent deployment", func(t *testing.T) {
		versions, err := getter.GetCandidateVersions(ctx, uuid.New())
		require.NoError(t, err)
		assert.Empty(t, versions)
	})
}

func TestPostgresGetter_HasCurrentRelease(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := newGetter(pool)
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

func TestPostgresGetter_GetDeploymentVariables(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := newGetter(pool)

	t.Run("returns empty slice when no variables exist", func(t *testing.T) {
		vars, err := getter.GetDeploymentVariables(ctx, f.deploymentID.String())
		require.NoError(t, err)
		assert.Empty(t, vars)
	})

	t.Run("returns variable with values", func(t *testing.T) {
		varID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO variable (id, scope, deployment_id, key, description)
			 VALUES ($1, 'deployment', $2, $3, $4)`,
			varID, f.deploymentID, "IMAGE_TAG", "The image tag")
		require.NoError(t, err)

		valID := uuid.New()
		valData, _ := json.Marshal("override-value")
		_, err = pool.Exec(
			ctx,
			`INSERT INTO variable_value (id, variable_id, literal_value, resource_selector, priority, kind)
			 VALUES ($1, $2, $3, $4, $5, 'literal')`,
			valID,
			varID,
			valData,
			`resource.kind == "Server"`,
			int64(10),
		)
		require.NoError(t, err)

		vars, err := getter.GetDeploymentVariables(ctx, f.deploymentID.String())
		require.NoError(t, err)

		assert.Len(t, vars, 1)
		assert.Equal(t, "IMAGE_TAG", vars[0].Variable.Key)
		assert.Equal(t, f.deploymentID.String(), vars[0].Variable.DeploymentId)

		desc := "The image tag"
		assert.Equal(t, &desc, vars[0].Variable.Description)

		assert.Len(t, vars[0].Values, 1)
		assert.Equal(t, int64(10), vars[0].Values[0].Priority)
		assert.NotNil(t, vars[0].Values[0].ResourceSelector)
	})

	t.Run("variable with no values returns empty values slice", func(t *testing.T) {
		varID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO variable (id, scope, deployment_id, key, description)
			 VALUES ($1, 'deployment', $2, $3, $4)`,
			varID, f.deploymentID, "STANDALONE_VAR", "no overrides")
		require.NoError(t, err)

		vars, err := getter.GetDeploymentVariables(ctx, f.deploymentID.String())
		require.NoError(t, err)

		var found bool
		for _, v := range vars {
			if v.Variable.Key == "STANDALONE_VAR" {
				found = true
				assert.Empty(t, v.Values, "variable with no value rows should have empty Values")
			}
		}
		assert.True(t, found, "STANDALONE_VAR should be in results")
	})

	t.Run("multiple variables each get their own values", func(t *testing.T) {
		varA := uuid.New()
		varB := uuid.New()

		_, err := pool.Exec(ctx,
			`INSERT INTO variable (id, scope, deployment_id, key)
			 VALUES ($1, 'deployment', $2, $3)`,
			varA, f.deploymentID, "VAR_A")
		require.NoError(t, err)
		_, err = pool.Exec(ctx,
			`INSERT INTO variable (id, scope, deployment_id, key)
			 VALUES ($1, 'deployment', $2, $3)`,
			varB, f.deploymentID, "VAR_B")
		require.NoError(t, err)

		overrideA, _ := json.Marshal("a-override")
		_, err = pool.Exec(
			ctx,
			`INSERT INTO variable_value (id, variable_id, literal_value, resource_selector, priority, kind)
			 VALUES ($1, $2, $3, $4, $5, 'literal')`,
			uuid.New(),
			varA,
			overrideA,
			`resource.kind == "Server"`,
			int64(1),
		)
		require.NoError(t, err)

		overrideB, _ := json.Marshal("b-override")
		_, err = pool.Exec(
			ctx,
			`INSERT INTO variable_value (id, variable_id, literal_value, resource_selector, priority, kind)
			 VALUES ($1, $2, $3, $4, $5, 'literal')`,
			uuid.New(),
			varB,
			overrideB,
			`resource.kind == "Worker"`,
			int64(2),
		)
		require.NoError(t, err)

		vars, err := getter.GetDeploymentVariables(ctx, f.deploymentID.String())
		require.NoError(t, err)

		byKey := map[string][]int64{}
		for _, v := range vars {
			for _, val := range v.Values {
				byKey[v.Variable.Key] = append(byKey[v.Variable.Key], val.Priority)
			}
		}
		assert.Contains(t, byKey, "VAR_A", "VAR_A should be present")
		assert.Contains(t, byKey, "VAR_B", "VAR_B should be present")
		if priorities, ok := byKey["VAR_A"]; ok {
			assert.NotContains(t, priorities, int64(2),
				"VAR_A should not contain VAR_B's value priority")
		}
	})

	t.Run("errors on invalid deployment ID", func(t *testing.T) {
		_, err := getter.GetDeploymentVariables(ctx, "not-a-uuid")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse deployment id")
	})
}

func TestPostgresGetter_GetResourceVariables(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := newGetter(pool)

	t.Run("returns empty map when no variables exist", func(t *testing.T) {
		vars, err := getter.GetResourceVariables(ctx, f.resourceID.String())
		require.NoError(t, err)
		assert.NotNil(t, vars, "should return empty map, not nil")
		assert.Empty(t, vars)
	})

	insertResourceVar := func(key string, literal []byte) {
		varID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO variable (id, scope, resource_id, key) VALUES ($1, 'resource', $2, $3)`,
			varID, f.resourceID, key)
		require.NoError(t, err)
		_, err = pool.Exec(
			ctx,
			`INSERT INTO variable_value (variable_id, priority, kind, literal_value) VALUES ($1, 0, 'literal', $2)`,
			varID,
			literal,
		)
		require.NoError(t, err)
	}

	t.Run("returns variables keyed by their key", func(t *testing.T) {
		valData, _ := json.Marshal("my-resource-value")
		insertResourceVar("REGION", valData)

		vars, err := getter.GetResourceVariables(ctx, f.resourceID.String())
		require.NoError(t, err)

		assert.Len(t, vars, 1)
		rvs, ok := vars["REGION"]
		require.True(t, ok)
		require.Len(t, rvs, 1)
		assert.Equal(t, f.resourceID.String(), rvs[0].ResourceId)
		assert.Equal(t, "REGION", rvs[0].Key)
	})

	t.Run("returns multiple variables each under their own key", func(t *testing.T) {
		valA, _ := json.Marshal("us-east-1")
		valB, _ := json.Marshal("prod")
		insertResourceVar("AWS_REGION", valA)
		insertResourceVar("STAGE", valB)

		vars, err := getter.GetResourceVariables(ctx, f.resourceID.String())
		require.NoError(t, err)

		_, hasRegion := vars["AWS_REGION"]
		_, hasStage := vars["STAGE"]
		assert.True(t, hasRegion, "AWS_REGION should be present")
		assert.True(t, hasStage, "STAGE should be present")
	})

	t.Run("errors on invalid resource ID", func(t *testing.T) {
		_, err := getter.GetResourceVariables(ctx, "not-a-uuid")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse resource id")
	})
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

	getter := newGetter(pool)

	t.Run("returns empty slice when no skips exist", func(t *testing.T) {
		skips, err := getter.GetPolicySkips(
			ctx,
			versionID.String(),
			f.environmentID.String(),
			f.resourceID.String(),
		)
		require.NoError(t, err)
		assert.Empty(t, skips)
	})

	t.Run("returns targeted skip with all fields", func(t *testing.T) {
		ruleID := uuid.New()
		skipID := uuid.New()
		_, err := pool.Exec(
			ctx,
			`INSERT INTO policy_skip (id, version_id, rule_id, environment_id, resource_id, reason, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			skipID,
			versionID,
			ruleID,
			f.environmentID,
			f.resourceID,
			"emergency deploy",
			"user-1",
		)
		require.NoError(t, err)

		skips, err := getter.GetPolicySkips(
			ctx,
			versionID.String(),
			f.environmentID.String(),
			f.resourceID.String(),
		)
		require.NoError(t, err)

		assert.Len(t, skips, 1)
		assert.Equal(t, skipID.String(), skips[0].Id)
		assert.Equal(t, "emergency deploy", skips[0].Reason)
		assert.Equal(t, "user-1", skips[0].CreatedBy)
		assert.Equal(t, ruleID.String(), skips[0].RuleId)
	})

	t.Run("null environment and resource matches any target", func(t *testing.T) {
		globalSkipID := uuid.New()
		_, err := pool.Exec(
			ctx,
			`INSERT INTO policy_skip (id, version_id, rule_id, environment_id, resource_id, reason, created_by)
			 VALUES ($1, $2, $3, NULL, NULL, $4, $5)`,
			globalSkipID,
			versionID,
			uuid.New(),
			"global skip",
			"admin",
		)
		require.NoError(t, err)

		skips, err := getter.GetPolicySkips(
			ctx,
			versionID.String(),
			f.environmentID.String(),
			f.resourceID.String(),
		)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(skips), 2,
			"should include both targeted and global skips")
	})

	t.Run("errors on invalid version UUID", func(t *testing.T) {
		_, err := getter.GetPolicySkips(ctx, "bad", f.environmentID.String(), f.resourceID.String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse version id")
	})

	t.Run("errors on invalid environment UUID", func(t *testing.T) {
		_, err := getter.GetPolicySkips(ctx, versionID.String(), "bad", f.resourceID.String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse environment id")
	})

	t.Run("errors on invalid resource UUID", func(t *testing.T) {
		_, err := getter.GetPolicySkips(ctx, versionID.String(), f.environmentID.String(), "bad")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse resource id")
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

	getter := newGetter(pool)

	t.Run("returns empty slice when no records exist", func(t *testing.T) {
		records, err := getter.GetApprovalRecords(ctx, versionID.String(), f.environmentID.String())
		require.NoError(t, err)
		assert.Empty(t, records)
	})

	t.Run("returns approval record with all fields", func(t *testing.T) {
		userID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO user_approval_record (version_id, user_id, environment_id, status, reason)
			 VALUES ($1, $2, $3, $4, $5)`,
			versionID, userID, f.environmentID, "approved", "looks good")
		require.NoError(t, err)

		records, err := getter.GetApprovalRecords(ctx, versionID.String(), f.environmentID.String())
		require.NoError(t, err)

		assert.Len(t, records, 1)
		assert.Equal(t, versionID.String(), records[0].VersionId)
		assert.Equal(t, userID.String(), records[0].UserId)
		reason := "looks good"
		assert.Equal(t, &reason, records[0].Reason)
	})

	t.Run("returns multiple records for same version and environment", func(t *testing.T) {
		user2 := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO user_approval_record (version_id, user_id, environment_id, status, reason)
			 VALUES ($1, $2, $3, $4, $5)`,
			versionID, user2, f.environmentID, "approved", "also lgtm")
		require.NoError(t, err)

		records, err := getter.GetApprovalRecords(ctx, versionID.String(), f.environmentID.String())
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(records), 2,
			"should return all approval records for the version+environment pair")
	})

	t.Run("errors on invalid version UUID", func(t *testing.T) {
		_, err := getter.GetApprovalRecords(ctx, "not-a-uuid", f.environmentID.String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse version id")
	})

	t.Run("errors on invalid environment UUID", func(t *testing.T) {
		_, err := getter.GetApprovalRecords(ctx, versionID.String(), "not-a-uuid")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "parse environment id")
	})
}

func TestPostgresGetter_ReleaseTargetExists(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := newGetter(pool)
	rt := newReleaseTarget(f)

	t.Run("false when no computed rows link the triple", func(t *testing.T) {
		exists, err := getter.ReleaseTargetExists(ctx, rt)
		require.NoError(t, err)
		assert.False(t, exists)
	})

	t.Run("true when computed tables form a valid release target", func(t *testing.T) {
		systemID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO system (id, name, workspace_id) VALUES ($1, $2, $3)`,
			systemID, "test-system", f.workspaceID)
		require.NoError(t, err)

		_, err = pool.Exec(ctx,
			`INSERT INTO system_deployment (system_id, deployment_id) VALUES ($1, $2)`,
			systemID, f.deploymentID)
		require.NoError(t, err)

		_, err = pool.Exec(ctx,
			`INSERT INTO system_environment (system_id, environment_id) VALUES ($1, $2)`,
			systemID, f.environmentID)
		require.NoError(t, err)

		_, err = pool.Exec(
			ctx,
			`INSERT INTO computed_deployment_resource (deployment_id, resource_id, last_evaluated_at)
			 VALUES ($1, $2, NOW())`,
			f.deploymentID,
			f.resourceID,
		)
		require.NoError(t, err)

		_, err = pool.Exec(
			ctx,
			`INSERT INTO computed_environment_resource (environment_id, resource_id, last_evaluated_at)
			 VALUES ($1, $2, NOW())`,
			f.environmentID,
			f.resourceID,
		)
		require.NoError(t, err)

		t.Cleanup(func() {
			cleanCtx := context.Background()
			_, _ = pool.Exec(
				cleanCtx,
				"DELETE FROM computed_environment_resource WHERE environment_id = $1",
				f.environmentID,
			)
			_, _ = pool.Exec(
				cleanCtx,
				"DELETE FROM computed_deployment_resource WHERE deployment_id = $1",
				f.deploymentID,
			)
			_, _ = pool.Exec(
				cleanCtx,
				"DELETE FROM system_environment WHERE system_id = $1",
				systemID,
			)
			_, _ = pool.Exec(
				cleanCtx,
				"DELETE FROM system_deployment WHERE system_id = $1",
				systemID,
			)
			_, _ = pool.Exec(cleanCtx, "DELETE FROM system WHERE id = $1", systemID)
		})

		exists, err := getter.ReleaseTargetExists(ctx, rt)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("false for nonexistent IDs", func(t *testing.T) {
		nonexistent := &desiredrelease.ReleaseTarget{
			WorkspaceID:   f.workspaceID,
			DeploymentID:  uuid.New(),
			EnvironmentID: uuid.New(),
			ResourceID:    uuid.New(),
		}
		exists, err := getter.ReleaseTargetExists(ctx, nonexistent)
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

func TestPostgresGetter_GetReleaseTargetScope(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := newGetter(pool)
	rt := newReleaseTarget(f)

	t.Run("returns scope with deployment environment and resource", func(t *testing.T) {
		scope, err := getter.GetReleaseTargetScope(ctx, rt)
		require.NoError(t, err)
		require.NotNil(t, scope)

		require.NotNil(t, scope.Deployment)
		assert.Equal(t, f.deploymentID.String(), scope.Deployment.Id)
		assert.Equal(t, "test-deploy", scope.Deployment.Name)

		require.NotNil(t, scope.Environment)
		assert.Equal(t, f.environmentID.String(), scope.Environment.Id)
		assert.Equal(t, "test-env", scope.Environment.Name)

		require.NotNil(t, scope.Resource)
		assert.Equal(t, f.resourceID.String(), scope.Resource.Id)
		assert.Equal(t, "test-resource", scope.Resource.Name)
		assert.Equal(t, "Server", scope.Resource.Kind)
	})

	t.Run("errors when deployment does not exist", func(t *testing.T) {
		bad := &desiredrelease.ReleaseTarget{
			DeploymentID:  uuid.New(),
			EnvironmentID: f.environmentID,
			ResourceID:    f.resourceID,
		}
		_, err := getter.GetReleaseTargetScope(ctx, bad)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "get deployment")
	})

	t.Run("errors when environment does not exist", func(t *testing.T) {
		bad := &desiredrelease.ReleaseTarget{
			DeploymentID:  f.deploymentID,
			EnvironmentID: uuid.New(),
			ResourceID:    f.resourceID,
		}
		_, err := getter.GetReleaseTargetScope(ctx, bad)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "get environment")
	})

	t.Run("errors when resource does not exist", func(t *testing.T) {
		bad := &desiredrelease.ReleaseTarget{
			DeploymentID:  f.deploymentID,
			EnvironmentID: f.environmentID,
			ResourceID:    uuid.New(),
		}
		_, err := getter.GetReleaseTargetScope(ctx, bad)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "get resource")
	})
}
