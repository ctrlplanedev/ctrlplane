package cel

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/util"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

var (
	compilationCache, _ = ristretto.NewCache(&ristretto.Config[string, cel.Program]{
		NumCounters: 50000,
		MaxCost:     1 << 30, // 1GB
		BufferItems: 64,
	})
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
	if program, ok := compilationCache.Get(expression); ok {
		return &CelSelector{Program: program, Cel: expression}, nil
	}

	ast, iss := Env.Compile(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}
	program, err := Env.Program(ast)
	if err != nil {
		return nil, err
	}

	compilationCache.SetWithTTL(expression, program, 1, 12*time.Hour)

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

// // structToMap converts a struct to a map using JSON marshaling
// // This is necessary because CEL cannot work with Go structs directly
// func structToMap(v any) (map[string]any, error) {
// 	data, err := json.Marshal(v)
// 	if err != nil {
// 		return nil, err
// 	}
// 	var result map[string]any
// 	if err := json.Unmarshal(data, &result); err != nil {
// 		return nil, err
// 	}
// 	return result, nil
// }

// structToMap converts a struct to a map using reflection
// This is significantly faster than JSON marshal/unmarshal
func structToMap(v any) (map[string]any, error) {
	// Fast path: already a map
	if m, ok := v.(map[string]any); ok {
		return m, nil
	}

	// For known types, we can use a specialized fast path
	switch entity := v.(type) {
	case *oapi.Resource:
		return resourceToMap(entity), nil
	case oapi.Resource:
		return resourceToMap(&entity), nil
	case *oapi.Deployment:
		return deploymentToMap(entity), nil
	case oapi.Deployment:
		return deploymentToMap(&entity), nil
	case *oapi.Environment:
		return environmentToMap(entity), nil
	case oapi.Environment:
		return environmentToMap(&entity), nil
	case *oapi.Job:
		return jobToMap(entity), nil
	case oapi.Job:
		return jobToMap(&entity), nil
	}

	// Fallback to JSON for unknown types
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

// Specialized converters for known types (zero allocation for known types)
func resourceToMap(r *oapi.Resource) map[string]any {
	m := make(map[string]any, 13)
	m["id"] = r.Id
	m["identifier"] = r.Identifier
	m["name"] = r.Name
	m["kind"] = r.Kind
	m["version"] = r.Version
	m["workspaceId"] = r.WorkspaceId
	m["config"] = r.Config
	m["metadata"] = r.Metadata
	m["createdAt"] = r.CreatedAt
	if r.ProviderId != nil {
		m["providerId"] = *r.ProviderId
	}
	if r.UpdatedAt != nil {
		m["updatedAt"] = *r.UpdatedAt
	}
	if r.DeletedAt != nil {
		m["deletedAt"] = *r.DeletedAt
	}
	if r.LockedAt != nil {
		m["lockedAt"] = *r.LockedAt
	}
	return m
}

func deploymentToMap(d *oapi.Deployment) map[string]any {
	m := make(map[string]any, 8)
	m["id"] = d.Id
	m["name"] = d.Name
	m["slug"] = d.Slug
	m["systemId"] = d.SystemId
	m["jobAgentConfig"] = d.JobAgentConfig
	if d.Description != nil {
		m["description"] = *d.Description
	}
	if d.JobAgentId != nil {
		m["jobAgentId"] = *d.JobAgentId
	}
	if d.ResourceSelector != nil {
		m["resourceSelector"] = d.ResourceSelector
	}
	return m
}

func environmentToMap(e *oapi.Environment) map[string]any {
	m := make(map[string]any, 6)
	m["id"] = e.Id
	m["name"] = e.Name
	m["systemId"] = e.SystemId
	m["createdAt"] = e.CreatedAt
	if e.Description != nil {
		m["description"] = *e.Description
	}
	if e.ResourceSelector != nil {
		m["resourceSelector"] = e.ResourceSelector
	}
	return m
}

func jobToMap(j *oapi.Job) map[string]any {
	m := make(map[string]any, 10)
	m["id"] = j.Id
	m["releaseId"] = j.ReleaseId
	m["jobAgentId"] = j.JobAgentId
	m["status"] = j.Status
	m["createdAt"] = j.CreatedAt
	m["updatedAt"] = j.UpdatedAt
	m["metadata"] = j.Metadata
	m["jobAgentConfig"] = j.JobAgentConfig
	if j.ExternalId != nil {
		m["externalId"] = *j.ExternalId
	}
	if j.CompletedAt != nil {
		m["completedAt"] = *j.CompletedAt
	}
	if j.StartedAt != nil {
		m["startedAt"] = *j.StartedAt
	}
	return m
}
