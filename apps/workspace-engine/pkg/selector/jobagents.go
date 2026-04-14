package selector

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
)

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

// MatchResult contains the matched agents and diagnostic information about
// the evaluation, useful for debugging why agents didn't match.
type MatchResult struct {
	Matched     []oapi.JobAgent
	Diagnostics MatchDiagnostics
}

// MatchDiagnostics captures why agents failed to match a selector.
type MatchDiagnostics struct {
	TotalAgents      int
	MatchedCount     int
	MissingKeyAgents []string
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
	result := MatchJobAgentsWithResourceDetailed(selector, agents, resource)
	return result.Result.Matched, result.Err
}

// MatchJobAgentsWithResourceDetailed performs the same evaluation as
// MatchJobAgentsWithResource but returns diagnostics explaining why agents
// were rejected, helping debug selectors that silently fail due to missing
// keys in the CEL context.
func MatchJobAgentsWithResourceDetailed(
	selector string,
	agents []oapi.JobAgent,
	resource *oapi.Resource,
) MatchDetailedResult {
	diag := MatchDiagnostics{TotalAgents: len(agents)}

	if selector == "" || selector == "false" {
		return MatchDetailedResult{Result: MatchResult{Diagnostics: diag}}
	}

	if selector == "true" {
		diag.MatchedCount = len(agents)
		return MatchDetailedResult{
			Result: MatchResult{Matched: agents, Diagnostics: diag},
		}
	}

	prg, err := jobAgentWithResourceEnv.Compile(selector)
	if err != nil {
		return MatchDetailedResult{
			Err: fmt.Errorf("invalid selector: %w", err),
		}
	}

	resourceMap := resourceToMap(resource)

	var matched []oapi.JobAgent
	for i := range agents {
		vars := map[string]any{
			"jobAgent": jobAgentToMap(&agents[i]),
			"resource": resourceMap,
		}
		ok, isMissingKey, err := celutil.EvalBoolDetailed(prg, vars)
		if err != nil {
			return MatchDetailedResult{
				Err: fmt.Errorf("eval job agent selector for agent %s: %w", agents[i].Id, err),
			}
		}
		if ok {
			matched = append(matched, agents[i])
		} else if isMissingKey {
			diag.MissingKeyAgents = append(diag.MissingKeyAgents, agents[i].Name)
		}
	}
	diag.MatchedCount = len(matched)
	return MatchDetailedResult{
		Result: MatchResult{Matched: matched, Diagnostics: diag},
	}
}

// MatchDetailedResult wraps the detailed match output and any error.
type MatchDetailedResult struct {
	Result MatchResult
	Err    error
}
