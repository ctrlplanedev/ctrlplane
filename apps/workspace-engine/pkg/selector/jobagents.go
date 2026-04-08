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

// MatchJobAgents evaluates a CEL job agent selector against a list of job
// agents and returns those that match. If the selector is empty or "false",
// no agents match.
func MatchJobAgents(
	ctx context.Context,
	selector string,
	agents []oapi.JobAgent,
) ([]oapi.JobAgent, error) {
	if selector == "" || selector == "false" {
		return nil, nil
	}

	if selector == "true" {
		return agents, nil
	}

	prg, err := jobAgentEnv.Compile(selector)
	if err != nil {
		return nil, fmt.Errorf("compile job agent selector: %w", err)
	}

	var matched []oapi.JobAgent
	for i := range agents {
		vars := map[string]any{
			"jobAgent": jobAgentToMap(&agents[i]),
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
