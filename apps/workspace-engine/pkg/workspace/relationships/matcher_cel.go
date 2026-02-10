package relationships

import (
	"fmt"
	"sync"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"
)

var compiledEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("from", "to").
	BuildCached(24 * time.Hour)

var activationPool = sync.Pool{
	New: func() any {
		return make(map[string]any, 2)
	},
}

func NewCelMatcher(cm *oapi.CelMatcher) (*CelMatcher, error) {
	program, err := compiledEnv.Compile(cm.Cel)
	if err != nil {
		return nil, fmt.Errorf("failed to compile cel expression: %w", err)
	}
	return &CelMatcher{program: program}, nil
}

// CelMatcher evaluates CEL matching between two entities
type CelMatcher struct {
	program cel.Program
}

func (m *CelMatcher) Evaluate(from map[string]any, to map[string]any) bool {
	celCtx := activationPool.Get().(map[string]any)
	celCtx["from"] = from
	celCtx["to"] = to

	result, err := celutil.EvalBool(m.program, celCtx)

	delete(celCtx, "from")
	delete(celCtx, "to")
	activationPool.Put(celCtx)

	if err != nil {
		log.Warn("CEL evaluation error", "error", err)
		return false
	}
	return result
}
