package selector

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
)

var jobAgentEnv, _ = celutil.NewEnvBuilder().
	WithMapVariable("jobAgent").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

var jobAgentWithResourceEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("jobAgent", "resource").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

func jobAgentToMap(a *oapi.JobAgent) map[string]any {
	m := make(map[string]any, 6)
	m["id"] = a.Id
	m["name"] = a.Name
	m["type"] = a.Type
	m["workspaceId"] = a.WorkspaceId
	m["config"] = a.Config
	if a.Metadata != nil {
		m["metadata"] = *a.Metadata
	}
	return m
}

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

// MatchJobAgents evaluates a CEL job agent selector against a list of job
// agents and returns those that match. If the selector is empty or "false",
// no agents match.
func MatchJobAgents(
	_ context.Context,
	selector string,
	agents []oapi.JobAgent,
) ([]oapi.JobAgent, error) {
	return matchJobAgents(jobAgentEnv, selector, agents, nil)
}

// MatchJobAgentsWithResource evaluates a CEL job agent selector against a list
// of job agents with the resource available in the CEL context, and returns
// those that match. This allows selectors to reference resource properties,
// e.g. "jobAgent.config.server == resource.config.argocd.serverUrl".
func MatchJobAgentsWithResource(
	_ context.Context,
	selector string,
	agents []oapi.JobAgent,
	resource *oapi.Resource,
) ([]oapi.JobAgent, error) {
	return matchJobAgents(jobAgentWithResourceEnv, selector, agents, resource)
}

func matchJobAgents(
	env *celutil.CompiledEnv,
	selector string,
	agents []oapi.JobAgent,
	resource *oapi.Resource,
) ([]oapi.JobAgent, error) {
	if selector == "" || selector == "false" {
		return nil, nil
	}

	if selector == "true" {
		return agents, nil
	}

	prg, err := env.Compile(selector)
	if err != nil {
		return nil, fmt.Errorf("compile job agent selector: %w", err)
	}

	var matched []oapi.JobAgent
	for i := range agents {
		vars := map[string]any{
			"jobAgent": jobAgentToMap(&agents[i]),
		}
		if resource != nil {
			vars["resource"] = resourceToMap(resource)
		}
		ok, err := celutil.EvalBool(prg, vars)
		if err != nil {
			return nil, fmt.Errorf("eval job agent selector for agent %s: %w", agents[i].Id, err)
		}
		if ok {
			matched = append(matched, agents[i])
		}
	}
	return matched, nil
}
