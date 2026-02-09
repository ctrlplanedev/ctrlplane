package relationships

import (
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"
)

var compiledEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("from", "to").
	BuildCached(24 * time.Hour)

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
	celCtx := map[string]any{
		"from": from,
		"to":   to,
	}
	result, err := celutil.EvalBool(m.program, celCtx)
	if err != nil {
		log.Warn("CEL evaluation error", "error", err)
		return false
	}
	return result
}
