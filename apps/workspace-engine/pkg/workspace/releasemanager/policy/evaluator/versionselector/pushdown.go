package versionselector

import (
	"sync"

	"github.com/google/cel-go/cel"
	"github.com/spandigital/cel2sql/v3"
	"github.com/spandigital/cel2sql/v3/pg"
)

// pushdownEnv is the CEL environment used to attempt SQL pushdown of a
// versionselector rule. It declares ONLY `version` because the iterator runs
// per-deployment and only version-scoped predicates can prune candidate rows
// at query time. Selectors that reference environment/resource/deployment will
// fail to compile here and fall back to runtime CEL evaluation.
var (
	pushdownEnv     *cel.Env
	pushdownEnvOnce sync.Once
	pushdownEnvErr  error
)

func getPushdownEnv() (*cel.Env, error) {
	pushdownEnvOnce.Do(func() {
		versionSchema := pg.NewSchema([]pg.FieldSchema{
			{Name: "id", Type: "uuid"},
			{Name: "tag", Type: "text"},
			{Name: "name", Type: "text"},
			{Name: "status", Type: "text"},
			{Name: "created_at", Type: "timestamptz"},
		})

		pushdownEnv, pushdownEnvErr = cel.NewEnv(
			cel.CustomTypeProvider(pg.NewTypeProvider(map[string]pg.Schema{
				"DeploymentVersion": versionSchema,
			})),
			cel.Variable("version", cel.ObjectType("DeploymentVersion")),
		)
	})
	return pushdownEnv, pushdownEnvErr
}

// TryPushDown attempts to convert a versionselector CEL expression into a SQL
// WHERE clause that can be appended to the candidate-version query. Returns
// ok=false for any expression cel2sql cannot translate (selectors that read
// environment/resource/deployment, function calls outside the supported set,
// JSONB/metadata access not declared in the schema, etc.) so callers can fall
// back to the row-by-row CEL evaluator.
//
// IMPORTANT: pushdown is an optimization, not a replacement. The CEL
// evaluator must still run per-version at reconcile time — pushdown narrows
// the candidate set, but its translation may diverge from CEL's runtime
// semantics in edge cases. The runtime evaluator is the source of truth.
func TryPushDown(selector string) (clause string, ok bool) {
	if selector == "" {
		return "", false
	}
	env, err := getPushdownEnv()
	if err != nil {
		return "", false
	}
	ast, issues := env.Compile(selector)
	if issues != nil && issues.Err() != nil {
		return "", false
	}
	sql, err := cel2sql.Convert(ast)
	if err != nil || sql == "" {
		return "", false
	}
	return sql, true
}
