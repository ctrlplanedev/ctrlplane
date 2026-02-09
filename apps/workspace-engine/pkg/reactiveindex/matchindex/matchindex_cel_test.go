package matchindex_test

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/reactiveindex/matchindex"

	"github.com/google/cel-go/cel"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testUUID generates a deterministic UUID from a namespace and index so tests
// are reproducible while using realistic ID formats.
func testUUID(namespace string, i int) string {
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(fmt.Sprintf("%s-%d", namespace, i))).String()
}

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
	res1 := testUUID("res", 1)
	res2 := testUUID("res", 2)
	res3 := testUUID("res", 3)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name":     "api-server",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "production", "team": "platform"},
	})
	eval.setEntity(res2, map[string]any{
		"name":     "worker",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "staging", "team": "platform"},
	})
	eval.setEntity(res3, map[string]any{
		"name":     "cron-job",
		"kind":     "CronJob",
		"metadata": map[string]any{"env": "production", "team": "data"},
	})

	idx := matchindex.New(eval.matchFunc)

	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddSelector(`resource.kind == "Deployment"`)
	idx.AddSelector(`resource.metadata["team"] == "platform" && resource.metadata["env"] == "staging"`)

	idx.AddEntity(res1)
	idx.AddEntity(res2)
	idx.AddEntity(res3)

	n := idx.Recompute(context.Background())
	assert.Equal(t, 9, n)

	// production resources
	prodMatches := sortedStrings(idx.GetMatches(`resource.metadata["env"] == "production"`))
	assert.Equal(t, sortedStrings([]string{res1, res3}), prodMatches)

	// Deployment kind
	deployMatches := sortedStrings(idx.GetMatches(`resource.kind == "Deployment"`))
	assert.Equal(t, sortedStrings([]string{res1, res2}), deployMatches)

	// staging + platform team
	stagingPlatform := idx.GetMatches(`resource.metadata["team"] == "platform" && resource.metadata["env"] == "staging"`)
	assert.Equal(t, []string{res2}, stagingPlatform)
}

func TestCel_EntityUpdate(t *testing.T) {
	res1 := testUUID("res", 1)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"env": "staging"},
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddEntity(res1)
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(`resource.metadata["env"] == "production"`, res1))

	// Promote to production
	eval.setEntity(res1, map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"env": "production"},
	})
	idx.DirtyEntity(res1)

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.True(t, idx.HasMatch(`resource.metadata["env"] == "production"`, res1))
}

func TestCel_SelectorUpdate(t *testing.T) {
	res1 := testUUID("res", 1)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name":     "api-server",
		"kind":     "Deployment",
		"metadata": map[string]any{"env": "production"},
	})

	idx := matchindex.New(eval.matchFunc)

	oldSelector := `resource.kind == "CronJob"`
	idx.AddSelector(oldSelector)
	idx.AddEntity(res1)
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(oldSelector, res1))

	// Selector changes — now matches Deployments instead
	idx.RemoveSelector(oldSelector)
	newSelector := `resource.kind == "Deployment"`
	idx.AddSelector(newSelector)

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.True(t, idx.HasMatch(newSelector, res1))
}

func TestCel_StringExtensions(t *testing.T) {
	res1 := testUUID("res", 1)
	res2 := testUUID("res", 2)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name": "us-east-1-api-server",
	})
	eval.setEntity(res2, map[string]any{
		"name": "eu-west-1-worker",
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.name.startsWith("us-east")`)
	idx.AddEntity(res1)
	idx.AddEntity(res2)
	idx.Recompute(context.Background())

	matches := idx.GetMatches(`resource.name.startsWith("us-east")`)
	assert.Equal(t, []string{res1}, matches)
}

func TestCel_MissingKeyReturnsFalse(t *testing.T) {
	res1 := testUUID("res", 1)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name": "api-server",
		// no "metadata" key
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.metadata["env"] == "production"`)
	idx.AddEntity(res1)
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch(`resource.metadata["env"] == "production"`, res1))
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
	res1 := testUUID("res", 1)
	res2 := testUUID("res", 2)
	res3 := testUUID("res", 3)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"kind": "Deployment",
	})
	eval.setEntity(res2, map[string]any{
		"kind": "StatefulSet",
	})
	eval.setEntity(res3, map[string]any{
		"kind": "CronJob",
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`resource.kind in ["Deployment", "StatefulSet"]`)
	idx.AddEntity(res1)
	idx.AddEntity(res2)
	idx.AddEntity(res3)
	idx.Recompute(context.Background())

	matches := sortedStrings(idx.GetMatches(`resource.kind in ["Deployment", "StatefulSet"]`))
	assert.Equal(t, sortedStrings([]string{res1, res2}), matches)
	assert.False(t, idx.HasMatch(`resource.kind in ["Deployment", "StatefulSet"]`, res3))
}

func TestCel_HasMacro(t *testing.T) {
	res1 := testUUID("res", 1)
	res2 := testUUID("res", 2)

	eval := newCelEvaluator()
	eval.setEntity(res1, map[string]any{
		"name":     "api-server",
		"metadata": map[string]any{"gpu": "true"},
	})
	eval.setEntity(res2, map[string]any{
		"name":     "worker",
		"metadata": map[string]any{},
	})

	idx := matchindex.New(eval.matchFunc)
	idx.AddSelector(`has(resource.metadata.gpu)`)
	idx.AddEntity(res1)
	idx.AddEntity(res2)
	idx.Recompute(context.Background())

	matches := idx.GetMatches(`has(resource.metadata.gpu)`)
	assert.Equal(t, []string{res1}, matches)
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

	rt1 := testUUID("rt", 1)
	rt2 := testUUID("rt", 2)

	entities := map[string]entity{
		rt1: {
			resource:    map[string]any{"name": "api-server", "kind": "Deployment"},
			deployment:  map[string]any{"name": "api-deploy"},
			environment: map[string]any{"name": "production"},
		},
		rt2: {
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
	idx.AddEntity(rt1)
	idx.AddEntity(rt2)
	idx.Recompute(context.Background())

	prodDeploy := idx.GetMatches(`environment.name == "production" && resource.kind == "Deployment"`)
	assert.Equal(t, []string{rt1}, prodDeploy)

	allDeploy := sortedStrings(idx.GetMatches(`deployment.name.endsWith("-deploy")`))
	assert.Equal(t, sortedStrings([]string{rt1, rt2}), allDeploy)
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

// --- CEL benchmarks ---

// celExpressions returns a set of realistic CEL selector expressions that
// exercise different evaluation paths (equality, string ops, compound logic).
func celExpressions() []string {
	return []string{
		`resource.metadata["env"] == "production"`,
		`resource.metadata["env"] == "staging"`,
		`resource.kind == "Deployment"`,
		`resource.kind == "StatefulSet"`,
		`resource.kind in ["Deployment", "StatefulSet"]`,
		`resource.name.startsWith("api-")`,
		`resource.name.startsWith("worker-")`,
		`has(resource.metadata.team)`,
		`resource.metadata["team"] == "platform" && resource.metadata["env"] == "production"`,
		`resource.kind == "CronJob" || resource.metadata["env"] == "staging"`,
	}
}

// buildCelIndex creates a CEL-backed MatchIndex with nSel selectors drawn from
// realistic expressions and nEnt entities with varied metadata.
func buildCelIndex(nSel, nEnt int) (*matchindex.MatchIndex, *celEvaluator) {
	eval := newCelEvaluator()

	kinds := []string{"Deployment", "StatefulSet", "CronJob", "DaemonSet", "Job"}
	envs := []string{"production", "staging", "development"}
	teams := []string{"platform", "data", "infra", "frontend", "backend"}

	entityIDs := make([]string, nEnt)
	for i := range nEnt {
		id := testUUID("entity", i)
		entityIDs[i] = id
		entity := map[string]any{
			"name": fmt.Sprintf("%s-%d", kinds[i%len(kinds)], i),
			"kind": kinds[i%len(kinds)],
			"metadata": map[string]any{
				"env":  envs[i%len(envs)],
				"team": teams[i%len(teams)],
			},
		}
		if i%7 == 0 {
			entity["name"] = fmt.Sprintf("api-%d", i)
		} else if i%11 == 0 {
			entity["name"] = fmt.Sprintf("worker-%d", i)
		}
		eval.setEntity(id, entity)
	}

	exprs := celExpressions()

	idx := matchindex.New(eval.matchFunc)
	for i := range nSel {
		idx.AddSelector(exprs[i%len(exprs)])
	}
	for _, id := range entityIDs {
		idx.AddEntity(id)
	}

	return idx, eval
}

// BenchmarkCel_Recompute_WorstCase measures full recompute with real CEL
// evaluation. Sizes are smaller than the hash benchmarks because CEL
// compile+eval is orders of magnitude more expensive.
func BenchmarkCel_Recompute_WorstCase(b *testing.B) {
	sizes := []struct{ sel, ent int }{
		// {1000, 1000},
		// {2000, 2000},
		// {5000, 5000},
		// {10_000, 10_000},
		{20_000, 20_000},
		{40_000, 40_000},
	}

	for _, sz := range sizes {
		totalPairs := int64(sz.sel) * int64(sz.ent)
		name := fmt.Sprintf("sel=%d_ent=%d_pairs=%d", sz.sel, sz.ent, totalPairs)

		b.Run(name, func(b *testing.B) {
			idx, _ := buildCelIndex(sz.sel, sz.ent)
			idx.Recompute(context.Background())

			var totalEvals int64
			b.ResetTimer()
			b.ReportAllocs()

			for b.Loop() {
				idx.DirtyAll()
				totalEvals += int64(idx.Recompute(context.Background()))
			}

			b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(totalEvals), "ns/pair")
			b.ReportMetric(float64(totalEvals)/b.Elapsed().Seconds(), "pairs/sec")
		})
	}
}
