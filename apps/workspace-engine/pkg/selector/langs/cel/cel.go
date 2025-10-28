package cel

import (
	"encoding/json"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/util"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

var Env, _ = cel.NewEnv(
	cel.Variable("resource", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("deployment", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("environment", cel.MapType(cel.StringType, cel.AnyType)),

	ext.Strings(),
	ext.Math(),
	ext.Lists(),
	ext.Sets(),
)

func Compile(expression string) (util.MatchableCondition, error) {
	ast, iss := Env.Compile(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}
	program, err := Env.Program(ast)
	if err != nil {
		return nil, err
	}
	return &CelSelector{Program: program, Cel: expression}, nil
}

type CelSelector struct {
	Program cel.Program
	Cel     string
}

func (s *CelSelector) Matches(entity any) (bool, error) {
	if s.Cel == "" {
		return false, nil
	}

	if s.Cel == "true" {
		return true, nil
	}

	if s.Cel == "false" {
		return false, nil
	}

	celCtx := map[string]any{
		"resource":    map[string]any{},
		"deployment":  map[string]any{},
		"environment": map[string]any{},
	}

	entityAsMap, err := structToMap(entity)
	if err != nil {
		return false, fmt.Errorf("failed to convert entity: %w", err)
	}

	_, isPointerResource := entity.(*oapi.Resource)
	_, isResource := entity.(oapi.Resource)
	if isPointerResource || isResource {
		celCtx["resource"] = entityAsMap
	}

	_, isPointerDeployment := entity.(*oapi.Deployment)
	_, isDeployment := entity.(oapi.Deployment)
	if isPointerDeployment || isDeployment {
		celCtx["deployment"] = entityAsMap
	}

	_, isPointerEnvironment := entity.(*oapi.Environment)
	_, isEnvironment := entity.(oapi.Environment)
	if isPointerEnvironment || isEnvironment {
		celCtx["environment"] = entityAsMap
	}

	_, isJob := entity.(oapi.Job)
	_, isPointerJob := entity.(*oapi.Job)
	if isJob || isPointerJob {
		celCtx["job"] = entityAsMap
	}

	val, _, err := s.Program.Eval(celCtx)
	if err != nil {
		// If the CEL expression fails due to a missing key, treat as non-match (false, nil)
		if strings.Contains(err.Error(), "no such key:") {
			return false, nil
		}

		log.Error("CEL Evaluation ERROR", "error", err)
		return false, err
	}

	result := val.ConvertToType(cel.BoolType)
	boolVal, ok := result.Value().(bool)
	if !ok {
		return false, fmt.Errorf("result is not a boolean")
	}
	return boolVal, nil
}

// structToMap converts a struct to a map using JSON marshaling
// This is necessary because CEL cannot work with Go structs directly
func structToMap(v any) (map[string]any, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}
