package versionselector

import (
	"time"
	"workspace-engine/pkg/celutil"

	"github.com/google/cel-go/cel"
)

var compiledEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("version", "environment", "resource", "deployment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

// compile compiles a CEL expression and returns the cached program.
func compile(expression string) (cel.Program, error) {
	return compiledEnv.Compile(expression)
}

// evaluate evaluates a CEL program with the given context.
func evaluate(program cel.Program, celCtx map[string]any) (bool, error) {
	return celutil.EvalBool(program, celCtx)
}
