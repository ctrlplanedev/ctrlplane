package jobdispatch

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/selector"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// DispatchProgressionTargets enqueues desired-release evaluations for
// release targets that are gated by environment progression policies
// whose dependsOnEnvironmentSelector matches the environment of the
// given job.
func dispatchProgressionTargets(
	ctx context.Context,
	queue reconcile.Queue,
	jobID uuid.UUID,
) error {
	ctx, span := tracer.Start(ctx, "DispatchProgressionTargets",
		trace.WithAttributes(attribute.String("job.id", jobID.String())),
	)
	defer span.End()

	queries := db.GetQueries(ctx)

	release, err := queries.GetReleaseByJobID(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get release by job id: %w", err)
	}

	wsID, err := queries.GetWorkspaceIDByJobID(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get workspace id: %w", err)
	}

	span.SetAttributes(
		attribute.String("workspace.id", wsID.String()),
		attribute.String("environment.id", release.EnvironmentID.String()),
	)

	jobEnv, err := queries.GetEnvironmentByID(ctx, release.EnvironmentID)
	if err != nil {
		return fmt.Errorf("get environment by id: %w", err)
	}
	jobOapiEnv := db.ToOapiEnvironment(jobEnv)

	dependentEnvIDs, err := findDependentEnvironments(ctx, queries, wsID, jobOapiEnv)
	if err != nil {
		return fmt.Errorf("find dependent environments: %w", err)
	}

	span.SetAttributes(attribute.Int("dependent_environments.count", len(dependentEnvIDs)))

	jobReleaseTarget := releaseTargetForJob(wsID, release)

	if len(dependentEnvIDs) == 0 {
		span.AddEvent("no dependent environments found, dispatching job release target only")
		if err := events.EnqueueManyDesiredRelease(queue, ctx, []events.DesiredReleaseEvalParams{jobReleaseTarget}); err != nil {
			return fmt.Errorf("enqueue desired releases: %w", err)
		}
		return nil
	}

	params, err := collectReleaseTargets(ctx, queries, wsID, dependentEnvIDs)
	if err != nil {
		return fmt.Errorf("collect release targets: %w", err)
	}

	params = append(params, jobReleaseTarget)

	span.SetAttributes(attribute.Int("release_targets.count", len(params)))

	if err := events.EnqueueManyDesiredRelease(queue, ctx, params); err != nil {
		return fmt.Errorf("enqueue desired releases: %w", err)
	}

	span.AddEvent("desired releases enqueued", trace.WithAttributes(
		attribute.Int("enqueued.count", len(params)),
	))

	return nil
}

// findDependentEnvironments returns the IDs of environments that have
// policies with environment progression rules whose
// dependsOnEnvironmentSelector matches jobEnv.
func findDependentEnvironments(
	ctx context.Context,
	queries *db.Queries,
	workspaceID uuid.UUID,
	jobEnv *oapi.Environment,
) ([]uuid.UUID, error) {
	policyRows, err := queries.ListPoliciesWithRulesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list policies: %w", err)
	}

	envRows, err := queries.ListEnvironmentsByWorkspaceID(ctx, db.ListEnvironmentsByWorkspaceIDParams{
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, fmt.Errorf("list environments: %w", err)
	}

	seen := make(map[uuid.UUID]struct{})
	var envIDs []uuid.UUID

	for _, row := range policyRows {
		policy := db.ToOapiPolicyWithRules(row)
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			if rule.EnvironmentProgression == nil {
				continue
			}

			sel := rule.EnvironmentProgression.DependsOnEnvironmentSelector
			if sel == "" {
				continue
			}

			matched, err := selector.Match(ctx, sel, *jobEnv)
			if err != nil {
				continue
			}
			if !matched {
				continue
			}

			policyEnvIDs, err := environmentsMatchingPolicy(ctx, envRows, policy)
			if err != nil {
				continue
			}

			for _, eid := range policyEnvIDs {
				if eid == jobEnv.Id {
					continue
				}
				uid, err := uuid.Parse(eid)
				if err != nil {
					continue
				}
				if _, ok := seen[uid]; !ok {
					seen[uid] = struct{}{}
					envIDs = append(envIDs, uid)
				}
			}
		}
	}

	return envIDs, nil
}

// environmentsMatchingPolicy returns the environment IDs that the
// policy's top-level selector applies to.
func environmentsMatchingPolicy(
	ctx context.Context,
	envRows []db.Environment,
	policy *oapi.Policy,
) ([]string, error) {
	if policy.Selector == "" {
		return nil, nil
	}

	if policy.Selector == "true" {
		ids := make([]string, len(envRows))
		for i, e := range envRows {
			ids[i] = e.ID.String()
		}
		return ids, nil
	}

	var ids []string
	for _, e := range envRows {
		env := db.ToOapiEnvironment(e)
		matched, err := selector.Match(ctx, policy.Selector, *env)
		if err != nil {
			continue
		}
		if matched {
			ids = append(ids, env.Id)
		}
	}
	return ids, nil
}

// collectReleaseTargets gathers all release targets for the given
// environment IDs and returns them as DesiredReleaseEvalParams.
func collectReleaseTargets(
	ctx context.Context,
	queries *db.Queries,
	workspaceID uuid.UUID,
	envIDs []uuid.UUID,
) ([]events.DesiredReleaseEvalParams, error) {
	rts, err := queries.GetReleaseTargetsForEnvironments(ctx, envIDs)
	if err != nil {
		return nil, fmt.Errorf("get release targets for environments: %w", err)
	}

	wsIDStr := workspaceID.String()
	params := make([]events.DesiredReleaseEvalParams, len(rts))
	for i, rt := range rts {
		params[i] = events.DesiredReleaseEvalParams{
			WorkspaceID:   wsIDStr,
			ResourceID:    rt.ResourceID.String(),
			EnvironmentID: rt.EnvironmentID.String(),
			DeploymentID:  rt.DeploymentID.String(),
		}
	}

	return params, nil
}

func releaseTargetForJob(workspaceID uuid.UUID, release db.Release) events.DesiredReleaseEvalParams {
	return events.DesiredReleaseEvalParams{
		WorkspaceID:   workspaceID.String(),
		ResourceID:    release.ResourceID.String(),
		EnvironmentID: release.EnvironmentID.String(),
		DeploymentID:  release.DeploymentID.String(),
	}
}
