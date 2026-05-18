package variableresolver

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
)

// JobAgentVarsGetter is the subset of Getter required to resolve
// job_agent-scoped variables. It exists so the jobs.Factory (which only
// needs this one method) can depend on the smaller interface.
type JobAgentVarsGetter interface {
	GetJobAgentVariables(
		ctx context.Context,
		jobAgentID uuid.UUID,
	) ([]oapi.DeploymentVariableWithValues, error)
}

// ResolveForJobAgent resolves every variable scoped to the given job agent
// and returns the resolved map plus the list of keys whose value originated
// from a secret_ref. Job-agent variables do not honor resource selectors —
// they apply to every dispatch through this agent — so only the highest
// priority candidate per key is evaluated.
//
// The boolean return on each helper is propagated through to populate
// release.EncryptedVariables. Errors wrapping ErrSecretResolution short
// circuit and block the dispatch.
func ResolveForJobAgent(
	ctx context.Context,
	getter JobAgentVarsGetter,
	secretResolver SecretResolver,
	workspaceID uuid.UUID,
	jobAgentID uuid.UUID,
) (map[string]oapi.LiteralValue, []string, error) {
	ctx, span := tracer.Start(ctx, "variableresolver.ResolveForJobAgent")
	defer span.End()
	span.SetAttributes(
		attribute.String("workspace.id", workspaceID.String()),
		attribute.String("job_agent.id", jobAgentID.String()),
	)

	vars, err := getter.GetJobAgentVariables(ctx, jobAgentID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get job_agent variables failed")
		return nil, nil, fmt.Errorf("get job_agent variables: %w", err)
	}
	span.SetAttributes(attribute.Int("job_agent_variables.count", len(vars)))

	if len(vars) == 0 {
		return map[string]oapi.LiteralValue{}, nil, nil
	}

	resolved := make(map[string]oapi.LiteralValue, len(vars))
	var sensitiveKeys []string

	for _, v := range vars {
		key := v.Variable.Key
		if len(v.Values) == 0 {
			continue
		}

		values := append([]oapi.DeploymentVariableValue(nil), v.Values...)
		sort.Slice(values, func(i, j int) bool {
			return values[i].Priority > values[j].Priority
		})

		for _, vv := range values {
			// Job-agent variables resolve outside a release-target context,
			// so reference values (which traverse related entities) cannot
			// be resolved here. Skip non-literal, non-secret_ref kinds.
			valueType, err := vv.Value.GetType()
			if err != nil {
				continue
			}
			if valueType != "literal" && valueType != "secret_ref" {
				continue
			}
			lv, sensitive, err := ResolveValue(
				ctx,
				nil,
				secretResolver,
				workspaceID,
				"",
				nil,
				&vv.Value,
			)
			if errors.Is(err, ErrSecretResolution) {
				span.RecordError(err)
				span.SetStatus(codes.Error, "resolve job_agent secret_ref failed")
				return nil, nil, fmt.Errorf("resolve job_agent variable %q: %w", key, err)
			}
			if err == nil && lv != nil {
				resolved[key] = *lv
				if sensitive {
					sensitiveKeys = append(sensitiveKeys, key)
				}
				break
			}
		}
	}

	span.SetAttributes(
		attribute.Int("job_agent_variables.resolved", len(resolved)),
		attribute.Int("job_agent_variables.sensitive", len(sensitiveKeys)),
	)
	return resolved, sensitiveKeys, nil
}
