package relationships

import (
	"context"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
	"github.com/google/cel-go/cel"
)

var Env, _ = cel.NewEnv(
	cel.Variable("from", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("to", cel.MapType(cel.StringType, cel.AnyType)),
)

var compilationCache, _ = ristretto.NewCache(&ristretto.Config[string, cel.Program]{
	NumCounters: 50000,
	MaxCost:     1 << 30, // 1GB
	BufferItems: 64,
})

func NewCelMatcher(cm *oapi.CelMatcher) (*CelMatcher, error) {
	if program, ok := compilationCache.Get(cm.Cel); ok {
		return &CelMatcher{program: program}, nil
	}

	ast, iss := Env.Compile(cm.Cel)
	if iss.Err() != nil {
		return nil, fmt.Errorf("failed to compile cel expression: %w", iss.Err())
	}
	program, err := Env.Program(ast)
	if err != nil {
		return nil, err
	}
	compilationCache.SetWithTTL(cm.Cel, program, 1, 24*time.Hour)
	return &CelMatcher{
		program: program,
	}, nil
}

// CelMatcher evaluates CEL matching between two entities
type CelMatcher struct {
	program cel.Program
}

func (m *CelMatcher) Evaluate(ctx context.Context, from map[string]any, to map[string]any) bool {
	_, span := tracer.Start(ctx, "Relationships.CelMatcher.Evaluate")
	defer span.End()

	// Convert entities to maps for CEL evaluation
	celCtx := map[string]any{
		"from": from,
		"to":   to,
	}
	val, _, err := m.program.Eval(celCtx)
	if err != nil {
		if strings.Contains(err.Error(), "no such key:") {
			return false
		}
		log.Warn("CEL evaluation error", "error", err)
		return false
	}
	result := val.ConvertToType(cel.BoolType)
	boolVal, ok := result.Value().(bool)
	if !ok {
		log.Warn("CEL result is not boolean", "result", result)
		return false
	}
	return boolVal
}
