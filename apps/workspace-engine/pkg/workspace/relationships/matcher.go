package relationships

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"
)

func Matches(ctx context.Context, matcher *oapi.RelationshipRule_Matcher, from *oapi.RelatableEntity, to *oapi.RelatableEntity) bool {
	pm, err := matcher.AsPropertiesMatcher()

	if err != nil {
		log.Warn("failed to get properties matcher", "error", err)
	}

	if err == nil && len(pm.Properties) > 0 {
		for _, pm := range pm.Properties {
			matcher := NewPropertyMatcher(&pm)
			if !matcher.Evaluate(ctx, from, to) {
				return false
			}
		}
		return true
	}
	
	
	cm, err := matcher.AsCelMatcher()
	if err != nil {
		log.Warn("failed to get cel matcher", "error", err)
	}

	if err == nil && cm.Cel != "" {
		matcher, err := NewCelMatcher(&cm)
		if err != nil {
			log.Warn("failed to new cel matcher", "error", err)
			return false
		}
		return matcher.Evaluate(ctx, from, to)
	}
	
	// No matcher specified - match by selectors only
	return true
}

func NewPropertyMatcher(pm *oapi.PropertyMatcher) *PropertyMatcher {
	if pm.Operator == "" {
		pm.Operator = "equals"
	}
	return &PropertyMatcher{
		PropertyMatcher: pm,
	}
}

// PropertyMatcher evaluates property matching between two entities
type PropertyMatcher struct {
	*oapi.PropertyMatcher
}

func (m *PropertyMatcher) Evaluate(ctx context.Context, from *oapi.RelatableEntity, to *oapi.RelatableEntity) bool {
	fromValue, err := GetPropertyValue(from, m.FromProperty)
	if err != nil {
		return false
	}
	toValue, err := GetPropertyValue(to, m.ToProperty)
	if err != nil {
		return false
	}

	fromValueStr := extractValueAsString(fromValue)
	toValueStr := extractValueAsString(toValue)

	operator := strings.ToLower(strings.TrimSpace(string(m.Operator)))
	switch operator {
	case "equals":
		return fromValueStr == toValueStr
	case "not_equals", "notequals":
		return fromValueStr != toValueStr
	case "contains", "contain":
		return strings.Contains(fromValueStr, toValueStr)
	case "starts_with", "startswith":
		return strings.HasPrefix(fromValueStr, toValueStr)
	case "ends_with", "endswith":
		return strings.HasSuffix(fromValueStr, toValueStr)
	}
	return true
}

var Env, _ = cel.NewEnv(
	cel.Variable("from", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("to", cel.MapType(cel.StringType, cel.AnyType)),
)

func NewCelMatcher(cm *oapi.CelMatcher) (*CelMatcher, error) {
	ast, iss := Env.Compile(cm.Cel)
	if iss.Err() != nil {
		return nil, fmt.Errorf("failed to compile cel expression: %w", iss.Err())
	}
	program, err := Env.Program(ast)
	if err != nil {
		return nil, err
	}
	return &CelMatcher{
		program: program,
	}, nil
}

// CelMatcher evaluates CEL matching between two entities
type CelMatcher struct {
	program cel.Program
}

func (m *CelMatcher) Evaluate(ctx context.Context, from *oapi.RelatableEntity, to *oapi.RelatableEntity) bool {
	// Convert entities to maps for CEL evaluation
	fromMap, err := entityToMap(from.Item())
	if err != nil {
		log.Warn("Failed to convert from entity to map", "error", err)
		return false
	}
	
	toMap, err := entityToMap(to.Item())
	if err != nil {
		log.Warn("Failed to convert to entity to map", "error", err)
		return false
	}
	
	celCtx := map[string]any{
		"from": fromMap,
		"to":   toMap,
	}
	val, _, err := m.program.Eval(celCtx)
	if err != nil {
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

// entityToMap converts an entity (Resource, Deployment, or Environment) to a map for CEL evaluation
func entityToMap(entity any) (map[string]any, error) {
	// Marshal to JSON and back to map to ensure CEL-compatible structure
	jsonBytes, err := json.Marshal(entity)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}
	
	var result map[string]any
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}
	
	return result, nil
}