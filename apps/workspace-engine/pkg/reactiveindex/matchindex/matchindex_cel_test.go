package matchindex_test

import (
	"context"
	"sort"
	"testing"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/reactiveindex/matchindex"

	"github.com/google/cel-go/cel"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// celEvaluator holds a compiled CEL environment and a registry of entities so
// that it can serve as the MatchFunc for a MatchIndex.
type celEvaluator struct {
	env      *celutil.CompiledEnv
	entities map[string]map[string]any
}

func newCelEvaluator() *celEvaluator {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource").
		WithStandardExtensions().
		BuildCached(1 * time.Hour)
	if err != nil {
		panic(err)
	}
	return &celEvaluator{
		env:      env,
		entities: make(map[string]map[string]any),
	}
}

func (e *celEvaluator) setEntity(id string, entity map[string]any) {
	e.entities[id] = entity
}

func (e *celEvaluator) matchFunc(_ context.Context, selectorID, entityID string) (bool, error) {
	program, err := e.env.Compile(selectorID)
	if err != nil {
		return false, err
	}

	entity, ok := e.entities[entityID]
	if !ok {
		return false, nil
	}

	return celutil.EvalBool(program, map[string]any{"resource": entity})
}

func sortedStrings(s []string) []string {
	out := make([]string, len(s))
	copy(out, s)
	sort.Strings(out)
	return out
}

func TestCel_MetadataLabelMatching(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name":     "api-server",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "production", "team": "platform"},
	})
	eval.setEntity("res-2", map[string]any{
		"name":     "worker",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "staging", "team": "platform"},
	})
	eval.setEntity("res-3", map[string]any{
		"name":     "cron-job",
		"kind":     "CronJob",
		"metadata": map[string]any{"env": "production", "team": "data"},
	})

	idx := matchindex.New(eval.matchFunc)

	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddSelector(`resource.kind == "Deployment"`)
	idx.AddSelector(`resource.metadata["team"] == "platform" && resource.metadata["env"] == "staging"`)

	idx.AddEntity("res-1")
	idx.AddEntity("res-2")
	idx.AddEntity("res-3")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 9, n)

	// production resources
	prodMatches := sortedStrings(idx.GetMatches(`resource.metadata["env"] == "production"`))
	assert.Equal(t, []string{"res-1", "res-3"}, prodMatches)

	// Deployment kind
	deployMatches := sortedStrings(idx.GetMatches(`resource.kind == "Deployment"`))
	assert.Equal(t, []string{"res-1", "res-2"}, deployMatches)

	// staging + platform team
	stagingPlatform := idx.GetMatches(`resource.metadata["team"] == "platform" && resource.metadata["env"] == "staging"`)
	assert.Equal(t, []string{"res-2"}, stagingPlatform)
}

func TestCel_EntityUpdate(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"env": "staging"},
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddEntity("res-1")
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(`resource.metadata["env"] == "production"`, "res-1"))

	// Promote to production
	eval.setEntity("res-1", map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"env": "production"},
	})
	idx.DirtyEntity("res-1")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.True(t, idx.HasMatch(`resource.metadata["env"] == "production"`, "res-1"))
}

func TestCel_SelectorUpdate(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name":     "api-server",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "production"},
	})

	idx := matchindex.New(eval.matchFunc)

	oldSelector := `resource.kind == "CronJob"`
	idx.AddSelector(oldSelector)
	idx.AddEntity("res-1")
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(oldSelector, "res-1"))

	// Selector changes — now matches Deployments instead
	idx.RemoveSelector(oldSelector)
	newSelector := `resource.kind == "Deployment"`
	idx.AddSelector(newSelector)

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.True(t, idx.HasMatch(newSelector, "res-1"))
}

func TestCel_StringExtensions(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name": "us-east-1-api-server",
	})
	eval.setEntity("res-2", map[string]any{
		"name": "eu-west-1-worker",
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.name.startsWith("us-east")`)
	idx.AddEntity("res-1")
	idx.AddEntity("res-2")
	idx.Recompute(context.Background())

	matches := idx.GetMatches(`resource.name.startsWith("us-east")`)
	assert.Equal(t, []string{"res-1"}, matches)
}

func TestCel_MissingKeyReturnsFalse(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name": "api-server",
		// no "metadata" key
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddEntity("res-1")
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(`resource.metadata["env"] == "production"`, "res-1"))
}

func TestCel_CompileError(t *testing.T) {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource").
		BuildCached(1 * time.Hour)
	require.NoError(t, err)

	_, err = env.Compile(`this is not valid cel !!!`)
	assert.Error(t, err)
}

func TestCel_InListExpression(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"kind": "Deployment",
	})
	eval.setEntity("res-2", map[string]any{
		"kind": "StatefulSet",
	})
	eval.setEntity("res-3", map[string]any{
		"kind": "CronJob",
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.kind in ["Deployment", "StatefulSet"]`)
	idx.AddEntity("res-1")
	idx.AddEntity("res-2")
	idx.AddEntity("res-3")
	idx.Recompute(context.Background())

	matches := sortedStrings(idx.GetMatches(`resource.kind in ["Deployment", "StatefulSet"]`))
	assert.Equal(t, []string{"res-1", "res-2"}, matches)
	assert.False(t, idx.HasMatch(`resource.kind in ["Deployment", "StatefulSet"]`, "res-3"))
}

func TestCel_HasMacro(t *testing.T) {
	eval := newCelEvaluator()
	eval.setEntity("res-1", map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"gpu": "true"},
	})
	eval.setEntity("res-2", map[string]any{
		"name":     "worker",
		"metadata": map[string]any{},
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`has(resource.metadata.gpu)`)
	idx.AddEntity("res-1")
	idx.AddEntity("res-2")
	idx.Recompute(context.Background())

	matches := idx.GetMatches(`has(resource.metadata.gpu)`)
	assert.Equal(t, []string{"res-1"}, matches)
}

func TestCel_RawEnvCompile(t *testing.T) {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource").
		WithStandardExtensions().
		BuildCached(1 * time.Hour)
	require.NoError(t, err)

	program, err := env.Compile(`resource.name.startsWith("api") && resource.metadata["env"] == "production"`)
	require.NoError(t, err)

	result, err := celutil.EvalBool(program, map[string]any{
		"resource": map[string]any{
			"name":     "api-server",
			"metadata": map[string]any{"env": "production"},
		},
	})
	require.NoError(t, err)
	assert.True(t, result)

	result, err = celutil.EvalBool(program, map[string]any{
		"resource": map[string]any{
			"name":     "worker",
			"metadata": map[string]any{"env": "production"},
		},
	})
	require.NoError(t, err)
	assert.False(t, result)
}

// Verify the celutil.Variables helper extracts referenced top-level identifiers.
func TestCel_VariableExtraction(t *testing.T) {
	vars, err := celutil.Variables(`resource.name == "x" && resource.metadata["env"] == "prod"`)
	require.NoError(t, err)
	assert.Equal(t, []string{"resource"}, vars)
}

// Verify compilation caching works — compiling the same expression twice
// should succeed and both programs should produce the same result.
func TestCel_CachingConsistency(t *testing.T) {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource").
		BuildCached(1 * time.Hour)
	require.NoError(t, err)

	expr := `resource.name == "test"`
	p1, err := env.Compile(expr)
	require.NoError(t, err)
	// Force cache population
	env.Compile(expr)
	p2, err := env.Compile(expr)
	require.NoError(t, err)

	vars := map[string]any{"resource": map[string]any{"name": "test"}}
	r1, err := celutil.EvalBool(p1, vars)
	require.NoError(t, err)
	r2, err := celutil.EvalBool(p2, vars)
	require.NoError(t, err)

	assert.True(t, r1)
	assert.Equal(t, r1, r2)
}

// Ensure the index with CEL is safe to use with the EnvBuilder directly,
// demonstrating how to set up a multi-variable CEL environment.
func TestCel_MultiVariableEnvironment(t *testing.T) {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource", "deployment", "environment").
		WithStandardExtensions().
		BuildCached(1 * time.Hour)
	require.NoError(t, err)

	type entity struct {
		resource    map[string]any
		deployment  map[string]any
		environment map[string]any
	}

	entities := map[string]entity{
		"rt-1": {
			resource:    map[string]any{"name": "api-server", "kind": "Deployment"},
			deployment:  map[string]any{"name": "api-deploy"},
			environment: map[string]any{"name": "production"},
		},
		"rt-2": {
			resource:    map[string]any{"name": "worker", "kind": "Deployment"},
			deployment:  map[string]any{"name": "worker-deploy"},
			environment: map[string]any{"name": "staging"},
		},
	}

	matchFunc := func(_ context.Context, selectorID, entityID string) (bool, error) {
		program, err := env.Compile(selectorID)
		if err != nil {
			return false, err
		}
		e, ok := entities[entityID]
		if !ok {
			return false, nil
		}
		return celutil.EvalBool(program, map[string]any{
			"resource":    e.resource,
			"deployment":  e.deployment,
			"environment": e.environment,
		})
	}

	idx := matchindex.New(matchFunc)
	idx.AddSelector(`environment.name == "production" && resource.kind == "Deployment"`)
	idx.AddSelector(`deployment.name.endsWith("-deploy")`)
	idx.AddEntity("rt-1")
	idx.AddEntity("rt-2")
	idx.Recompute(context.Background())

	prodDeploy := idx.GetMatches(`environment.name == "production" && resource.kind == "Deployment"`)
	assert.Equal(t, []string{"rt-1"}, prodDeploy)

	allDeploy := sortedStrings(idx.GetMatches(`deployment.name.endsWith("-deploy")`))
	assert.Equal(t, []string{"rt-1", "rt-2"}, allDeploy)
}

// Verify that the Validate helper correctly distinguishes valid from invalid expressions.
func TestCel_Validate(t *testing.T) {
	env, err := celutil.NewEnvBuilder().
		WithMapVariables("resource").
		BuildCached(1 * time.Hour)
	require.NoError(t, err)

	assert.NoError(t, env.Validate(`resource.name == "test"`))
	assert.Error(t, env.Validate(`not valid cel !!!`))
}

// Verify that the cel.BoolType constant used for EvalBool assertions
// is accessible (compile-time check).
func TestCel_BoolTypeAccessible(t *testing.T) {
	assert.NotNil(t, cel.BoolType)
}
