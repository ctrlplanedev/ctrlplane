package cel

import (
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/util"

	"github.com/google/cel-go/cel"
)

var compiledEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource", "deployment", "environment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

var Env = compiledEnv.Env()

func Compile(expression string) (util.MatchableCondition, error) {
	program, err := compiledEnv.Compile(expression)
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

	return celutil.EvalBool(s.Program, celCtx)
}

// structToMap converts a struct to a map.
// Known oapi types use hand-written converters for speed; everything else
// falls back to celutil.EntityToMap (JSON round-trip).
func structToMap(v any) (map[string]any, error) {
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

	return celutil.EntityToMap(v)
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
