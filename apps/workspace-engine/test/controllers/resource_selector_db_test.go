package controllers_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/store/resources"
	deployselector "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	envselector "workspace-engine/svc/controllers/environmentresourceselectoreval"
	. "workspace-engine/test/controllers/harness"
)

const defaultDBURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

func requireTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if !UseDBBacking() {
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

// dbFixture holds IDs for test data inserted into the database so they can be
// cleaned up after the test.
type dbFixture struct {
	pool          *pgxpool.Pool
	workspaceID   uuid.UUID
	providerID    uuid.UUID
	deploymentID  uuid.UUID
	environmentID uuid.UUID
	resourceIDs   []uuid.UUID
}

func (f *dbFixture) cleanup(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	for _, rid := range f.resourceIDs {
		_, _ = f.pool.Exec(ctx, "DELETE FROM resource WHERE id = $1", rid)
	}
	_, _ = f.pool.Exec(ctx, "DELETE FROM deployment WHERE id = $1", f.deploymentID)
	_, _ = f.pool.Exec(ctx, "DELETE FROM environment WHERE id = $1", f.environmentID)
	_, _ = f.pool.Exec(ctx, "DELETE FROM resource_provider WHERE id = $1", f.providerID)
	_, _ = f.pool.Exec(ctx, "DELETE FROM workspace WHERE id = $1", f.workspaceID)
}

func setupDBFixture(t *testing.T, pool *pgxpool.Pool) *dbFixture {
	t.Helper()
	ctx := context.Background()

	f := &dbFixture{
		pool:          pool,
		workspaceID:   uuid.New(),
		providerID:    uuid.New(),
		deploymentID:  uuid.New(),
		environmentID: uuid.New(),
	}
	t.Cleanup(func() { f.cleanup(t) })

	slug := "test-cel-" + f.workspaceID.String()[:8]
	_, err := pool.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		f.workspaceID, "test_cel_workspace", slug)
	require.NoError(t, err, "create workspace")

	_, err = pool.Exec(ctx,
		"INSERT INTO resource_provider (id, name, workspace_id) VALUES ($1, $2, $3)",
		f.providerID, "test-provider", f.workspaceID)
	require.NoError(t, err, "create resource_provider")

	_, err = pool.Exec(ctx,
		`INSERT INTO deployment (id, name, description, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		f.deploymentID, "test-deployment", "",
		`resource.metadata["kubernetes/status"] == "running"`,
		f.workspaceID)
	require.NoError(t, err, "create deployment")

	_, err = pool.Exec(ctx,
		`INSERT INTO environment (id, name, resource_selector, workspace_id)
		 VALUES ($1, $2, $3, $4)`,
		f.environmentID, "test-environment",
		`resource.kind == "GoogleKubernetesEngine"`,
		f.workspaceID)
	require.NoError(t, err, "create environment")

	richConfig, _ := json.Marshal(map[string]any{
		"name": "my-cluster",
		"googleKubernetesEngine": map[string]any{
			"autopilot":     true,
			"location":      "us-central1",
			"locationType":  "region",
			"network":       "default",
			"networkPolicy": false,
			"project":       "my-project",
			"status":        "RUNNING",
		},
		"server": map[string]any{
			"endpoint": "https://10.0.0.1",
		},
	})

	richMetadata, _ := json.Marshal(map[string]string{
		"kubernetes/status":  "running",
		"kubernetes/name":    "my-cluster",
		"kubernetes/version": "1.33.5",
		"kubernetes/type":    "gke",
		"google/project":     "my-project",
		"google/location":    "us-central1",
	})

	rID := uuid.New()
	f.resourceIDs = append(f.resourceIDs, rID)
	_, err = pool.Exec(
		ctx,
		`INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id, config, metadata, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, NOW())`,
		rID,
		"ctrlplane.dev/kubernetes/cluster/v1",
		"my-cluster",
		"GoogleKubernetesEngine",
		"https://container.googleapis.com/v1/projects/my-project/locations/us-central1/clusters/my-cluster",
		f.providerID,
		f.workspaceID,
		richConfig,
		richMetadata,
	)
	require.NoError(t, err, "create resource with rich config")

	simpleMetadata, _ := json.Marshal(map[string]string{
		"env":    "dev",
		"region": "us-east-1",
	})
	rID2 := uuid.New()
	f.resourceIDs = append(f.resourceIDs, rID2)
	_, err = pool.Exec(
		ctx,
		`INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id, config, metadata, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8::jsonb, NOW())`,
		rID2,
		"v1",
		"simple-server",
		"Server",
		"urn:simple-server",
		f.providerID,
		f.workspaceID,
		simpleMetadata,
	)
	require.NoError(t, err, "create simple resource")

	return f
}

// TestPostgresGetter_DeploymentResourceCELEvaluation verifies that the
// deployment PostgresGetter produces resource values that CEL can evaluate
// without "unsupported conversion to ref.Val" errors.
func TestPostgresGetter_DeploymentResourceCELEvaluation(t *testing.T) {
	pool := requireTestDB(t)
	f := setupDBFixture(t, pool)
	ctx := context.Background()

	getter := deployselector.NewPostgresGetter(nil)

	t.Run("GetResources returns CEL-compatible maps", func(t *testing.T) {
		resources, err := getter.GetResources(
			ctx,
			f.workspaceID.String(),
			resources.GetResourcesOptions{},
		)
		require.NoError(t, err)

		celEnv, err := celutil.NewEnvBuilder().
			WithMapVariables("resource").
			WithStandardExtensions().
			BuildCached(1 * time.Hour)
		require.NoError(t, err)

		prg, err := celEnv.Compile(`resource.metadata["kubernetes/status"] == "running"`)
		require.NoError(t, err)

		var matchCount int
		for _, res := range resources {
			resourceMap, mapErr := celutil.EntityToMap(res)
			require.NoError(t, mapErr, "EntityToMap must succeed for resource %s", res.Id)
			celCtx := map[string]any{"resource": resourceMap}
			ok, evalErr := celutil.EvalBool(prg, celCtx)
			require.NoError(t, evalErr, "CEL eval must not fail for resource %s", res.Id)
			if ok {
				matchCount++
			}
		}
		assert.Equal(t, 1, matchCount, "exactly one resource should have kubernetes/status=running")
	})

}

// TestPostgresGetter_EnvironmentResourceCELEvaluation verifies that the
// environment PostgresGetter produces resource values that CEL can evaluate
// without "unsupported conversion to ref.Val" errors.
func TestPostgresGetter_EnvironmentResourceCELEvaluation(t *testing.T) {
	pool := requireTestDB(t)
	f := setupDBFixture(t, pool)
	ctx := context.Background()

	getter := envselector.NewPostgresGetter(nil)

	t.Run("GetResources returns CEL-compatible maps", func(t *testing.T) {
		resources, err := getter.GetResources(
			ctx,
			f.workspaceID.String(),
			resources.GetResourcesOptions{},
		)
		require.NoError(t, err)

		celEnv, err := celutil.NewEnvBuilder().
			WithMapVariables("resource").
			WithStandardExtensions().
			BuildCached(1 * time.Hour)
		require.NoError(t, err)

		prg, err := celEnv.Compile(`resource.kind == "GoogleKubernetesEngine"`)
		require.NoError(t, err)

		var matchCount int
		for _, res := range resources {
			resourceMap, mapErr := celutil.EntityToMap(res)
			require.NoError(t, mapErr, "EntityToMap must succeed for resource %s", res.Id)
			celCtx := map[string]any{"resource": resourceMap}
			ok, evalErr := celutil.EvalBool(prg, celCtx)
			require.NoError(t, evalErr, "CEL eval must not fail for resource %s", res.Id)
			if ok {
				matchCount++
			}
		}
		assert.Equal(t, 1, matchCount, "exactly one resource should be GoogleKubernetesEngine")
	})
}
