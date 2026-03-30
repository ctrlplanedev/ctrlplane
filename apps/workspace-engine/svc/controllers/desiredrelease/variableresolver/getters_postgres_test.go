package variableresolver_test

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
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
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

	slug := "test-vr-" + f.workspaceID.String()[:8]
	_, err := pool.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		f.workspaceID, "test_var_resolver", slug)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		"INSERT INTO resource_provider (id, name, workspace_id) VALUES ($1, $2, $3)",
		f.providerID, "test-provider", f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO deployment (id, name, description, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		f.deploymentID, "test-deploy", "a test deployment", "true", f.workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO environment (id, name, description, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		f.environmentID, "test-env", "a test environment", "true", f.workspaceID)
	require.NoError(t, err)

	metadata, _ := json.Marshal(map[string]string{"env": "test", "region": "us-east-1"})
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
			"DELETE FROM relationship_rule WHERE workspace_id = $1",
			f.workspaceID,
		)
		_, _ = pool.Exec(
			cleanCtx,
			"DELETE FROM resource_variable WHERE resource_id = $1",
			f.resourceID,
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
		_, _ = pool.Exec(cleanCtx, "DELETE FROM resource WHERE workspace_id = $1", f.workspaceID)
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

func TestPostgresGetter_GetRelationshipRules(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := variableresolver.NewPostgresGetter(nil)

	t.Run("returns empty slice when no rules exist", func(t *testing.T) {
		rules, err := getter.GetRelationshipRules(ctx, f.workspaceID)
		require.NoError(t, err)
		assert.Len(t, rules, 0)
	})

	t.Run("returns rules with correct fields", func(t *testing.T) {
		ruleID := uuid.New()
		_, err := pool.Exec(ctx,
			`INSERT INTO relationship_rule (id, name, workspace_id, reference, cel)
			 VALUES ($1, $2, $3, $4, $5)`,
			ruleID, "depends-on", f.workspaceID,
			"deployment.depends_on", `source.metadata.team == target.metadata.team`)
		require.NoError(t, err)

		rules, err := getter.GetRelationshipRules(ctx, f.workspaceID)
		require.NoError(t, err)

		require.Len(t, rules, 1)
		assert.Equal(t, ruleID, rules[0].ID)
		assert.Equal(t, "deployment.depends_on", rules[0].Reference)
		assert.Equal(t, `source.metadata.team == target.metadata.team`, rules[0].Cel)
	})

	t.Run("does not return rules from other workspaces", func(t *testing.T) {
		otherWS := uuid.New()
		otherSlug := "test-vr-other-" + otherWS.String()[:8]
		_, err := pool.Exec(ctx,
			"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
			otherWS, "other_workspace", otherSlug)
		require.NoError(t, err)

		_, err = pool.Exec(ctx,
			`INSERT INTO relationship_rule (id, name, workspace_id, reference, cel)
			 VALUES ($1, $2, $3, $4, $5)`,
			uuid.New(), "other-rule", otherWS, "other.ref", "true")
		require.NoError(t, err)

		t.Cleanup(func() {
			cleanCtx := context.Background()
			_, _ = pool.Exec(
				cleanCtx,
				"DELETE FROM relationship_rule WHERE workspace_id = $1",
				otherWS,
			)
			_, _ = pool.Exec(cleanCtx, "DELETE FROM workspace WHERE id = $1", otherWS)
		})

		rules, err := getter.GetRelationshipRules(ctx, f.workspaceID)
		require.NoError(t, err)
		for _, r := range rules {
			assert.NotEqual(t, "other.ref", r.Reference,
				"should not return rules from a different workspace")
		}
	})
}

func TestPostgresGetter_LoadCandidates(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := variableresolver.NewPostgresGetter(nil)

	t.Run("resource type returns active resources", func(t *testing.T) {
		candidates, err := getter.LoadCandidates(ctx, f.workspaceID, "resource")
		require.NoError(t, err)

		var found bool
		for _, c := range candidates {
			if c.ID == f.resourceID {
				found = true
				assert.Equal(t, "resource", c.EntityType)
				assert.Equal(t, f.workspaceID, c.WorkspaceID)
				assert.Equal(t, "test-resource", c.Raw["name"])
				assert.Equal(t, "Server", c.Raw["kind"])
			}
		}
		assert.True(t, found, "fixture resource should be in candidates")
	})

	t.Run("resource type excludes soft-deleted resources", func(t *testing.T) {
		deletedID := uuid.New()
		metadata, _ := json.Marshal(map[string]string{})
		_, err := pool.Exec(
			ctx,
			`INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id, config, metadata, deleted_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8::jsonb, NOW())`,
			deletedID,
			"v1",
			"deleted-resource",
			"Server",
			"urn:test:deleted",
			f.providerID,
			f.workspaceID,
			metadata,
		)
		require.NoError(t, err)

		t.Cleanup(func() {
			_, _ = pool.Exec(context.Background(), "DELETE FROM resource WHERE id = $1", deletedID)
		})

		candidates, err := getter.LoadCandidates(ctx, f.workspaceID, "resource")
		require.NoError(t, err)

		for _, c := range candidates {
			assert.NotEqual(t, deletedID, c.ID,
				"soft-deleted resources should not appear in candidates")
		}
	})

	t.Run("deployment type returns deployments", func(t *testing.T) {
		candidates, err := getter.LoadCandidates(ctx, f.workspaceID, "deployment")
		require.NoError(t, err)

		var found bool
		for _, c := range candidates {
			if c.ID == f.deploymentID {
				found = true
				assert.Equal(t, "deployment", c.EntityType)
				assert.Equal(t, f.workspaceID, c.WorkspaceID)
				assert.Equal(t, "test-deploy", c.Raw["name"])
			}
		}
		assert.True(t, found, "fixture deployment should be in candidates")
	})

	t.Run("environment type returns environments", func(t *testing.T) {
		candidates, err := getter.LoadCandidates(ctx, f.workspaceID, "environment")
		require.NoError(t, err)

		var found bool
		for _, c := range candidates {
			if c.ID == f.environmentID {
				found = true
				assert.Equal(t, "environment", c.EntityType)
				assert.Equal(t, f.workspaceID, c.WorkspaceID)
				assert.Equal(t, "test-env", c.Raw["name"])
			}
		}
		assert.True(t, found, "fixture environment should be in candidates")
	})

	t.Run("unknown entity type returns error", func(t *testing.T) {
		_, err := getter.LoadCandidates(ctx, f.workspaceID, "unknown")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unknown entity type")
	})

	t.Run("empty workspace returns empty slice", func(t *testing.T) {
		emptyWS := uuid.New()
		emptySlug := "test-vr-empty-" + emptyWS.String()[:8]
		_, err := pool.Exec(ctx,
			"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
			emptyWS, "empty_workspace", emptySlug)
		require.NoError(t, err)

		t.Cleanup(func() {
			_, _ = pool.Exec(context.Background(), "DELETE FROM workspace WHERE id = $1", emptyWS)
		})

		candidates, err := getter.LoadCandidates(ctx, emptyWS, "resource")
		require.NoError(t, err)
		assert.Len(t, candidates, 0)
	})
}

func TestPostgresGetter_GetEntityByID(t *testing.T) {
	pool := requireTestDB(t)
	f := setupFixture(t, pool)
	ctx := context.Background()

	getter := variableresolver.NewPostgresGetter(nil)

	t.Run("resource by ID", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.resourceID, "resource")
		require.NoError(t, err)
		require.NotNil(t, entity)

		assert.Equal(t, f.resourceID, entity.ID)
		assert.Equal(t, f.workspaceID, entity.WorkspaceID)
		assert.Equal(t, "resource", entity.EntityType)
		assert.Equal(t, "test-resource", entity.Raw["name"])
		assert.Equal(t, "Server", entity.Raw["kind"])
	})

	t.Run("deployment by ID", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.deploymentID, "deployment")
		require.NoError(t, err)
		require.NotNil(t, entity)

		assert.Equal(t, f.deploymentID, entity.ID)
		assert.Equal(t, f.workspaceID, entity.WorkspaceID)
		assert.Equal(t, "deployment", entity.EntityType)
		assert.Equal(t, "test-deploy", entity.Raw["name"])
	})

	t.Run("environment by ID", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.environmentID, "environment")
		require.NoError(t, err)
		require.NotNil(t, entity)

		assert.Equal(t, f.environmentID, entity.ID)
		assert.Equal(t, f.workspaceID, entity.WorkspaceID)
		assert.Equal(t, "environment", entity.EntityType)
		assert.Equal(t, "test-env", entity.Raw["name"])
	})

	t.Run("unknown entity type returns error", func(t *testing.T) {
		_, err := getter.GetEntityByID(ctx, f.resourceID, "unknown")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unknown entity type")
	})

	t.Run("nonexistent resource ID returns error", func(t *testing.T) {
		_, err := getter.GetEntityByID(ctx, uuid.New(), "resource")
		require.Error(t, err)
	})

	t.Run("nonexistent deployment ID returns error", func(t *testing.T) {
		_, err := getter.GetEntityByID(ctx, uuid.New(), "deployment")
		require.Error(t, err)
	})

	t.Run("nonexistent environment ID returns error", func(t *testing.T) {
		_, err := getter.GetEntityByID(ctx, uuid.New(), "environment")
		require.Error(t, err)
	})

	t.Run("resource metadata maps to Raw correctly", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.resourceID, "resource")
		require.NoError(t, err)

		metadata, ok := entity.Raw["metadata"].(map[string]any)
		require.True(t, ok, "metadata should be a map[string]any")
		assert.Equal(t, "test", metadata["env"])
		assert.Equal(t, "us-east-1", metadata["region"])
	})

	t.Run("deployment description maps to Raw when present", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.deploymentID, "deployment")
		require.NoError(t, err)

		desc, ok := entity.Raw["description"]
		assert.True(t, ok, "description should be present when non-empty")
		assert.Equal(t, "a test deployment", desc)
	})

	t.Run("environment description maps to Raw when present", func(t *testing.T) {
		entity, err := getter.GetEntityByID(ctx, f.environmentID, "environment")
		require.NoError(t, err)

		desc, ok := entity.Raw["description"]
		assert.True(t, ok, "description should be present when non-empty")
		assert.Equal(t, "a test environment", desc)
	})
}
