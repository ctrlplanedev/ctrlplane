package policies

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("events/handler/policies")

func getAffectedTargets(ctx context.Context, ws *workspace.Workspace, policyID string) []*oapi.ReleaseTarget {
	releaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		return nil
	}

	allPolicies := ws.Policies().Items()
	policiesSlice := make([]*oapi.Policy, 0, len(allPolicies))
	for _, p := range allPolicies {
		policiesSlice = append(policiesSlice, p)
	}

	affectedTargets := make([]*oapi.ReleaseTarget, 0)
	for _, rt := range releaseTargets {
		matched, err := ws.ReleaseTargets().MatchPolicies(ctx, rt, policiesSlice)
		if err != nil {
			continue
		}
		for _, p := range matched {
			if p.Id == policyID {
				affectedTargets = append(affectedTargets, rt)
				break
			}
		}
	}
	return affectedTargets
}

func enqueueAffectedTargets(ctx context.Context, ws *workspace.Workspace, targets map[string]*oapi.ReleaseTarget) {
	params := make([]events.DesiredReleaseEvalParams, len(targets))
	for _, rt := range targets {
		params = append(params, events.DesiredReleaseEvalParams{
			WorkspaceID:   ws.ID,
			ResourceID:    rt.ResourceId,
			EnvironmentID: rt.EnvironmentId,
			DeploymentID:  rt.DeploymentId,
		})
	}
	if err := events.EnqueueManyDesiredRelease(ws.Queue(), ctx, params); err != nil {
		log.Error("failed to enqueue desired release for policy change", "error", err)
	}
}

func HandlePolicyCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	ws.Policies().Upsert(ctx, policy)

	affectedTargets := getAffectedTargets(ctx, ws, policy.Id)

	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	log.Info("Policy created - reconciling affected targets",
		"policy_id", policy.Id,
		"affected_targets_count", len(affectedTargets))
	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

	releaseTargets, err := ws.ReleaseTargets().Items()
	if err == nil {
		enqueueAffectedTargets(ctx, ws, releaseTargets)
	}

	return nil
}

func HandlePolicyUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandlePolicyUpdated")
	defer span.End()

	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	span.SetAttributes(
		attribute.String("policy.id", policy.Id),
		attribute.String("policy.name", policy.Name),
		attribute.Bool("policy.enabled", policy.Enabled),
		attribute.Int("policy.priority", policy.Priority),
		attribute.Int("policy.rules_count", len(policy.Rules)),
	)

	_, upsertSpan := tracer.Start(ctx, "UpsertPolicy")
	ws.Policies().Upsert(ctx, policy)
	upsertSpan.End()

	_, getAffectedTargetsSpan := tracer.Start(ctx, "GetAffectedTargets")
	affectedTargets := getAffectedTargets(ctx, ws, policy.Id)
	getAffectedTargetsSpan.End()

	_, dirtyDesiredReleaseSpan := tracer.Start(ctx, "DirtyDesiredRelease")
	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	dirtyDesiredReleaseSpan.End()

	_, recomputeStateSpan := tracer.Start(ctx, "RecomputeState")
	ws.ReleaseManager().RecomputeState(ctx)
	recomputeStateSpan.End()

	log.Info("Policy updated - reconciling affected targets",
		"policy_id", policy.Id,
		"policy_enabled", policy.Enabled,
		"affected_targets_count", len(affectedTargets))
	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

	releaseTargets, err := ws.ReleaseTargets().Items()
	if err == nil {
		enqueueAffectedTargets(ctx, ws, releaseTargets)
	}

	return nil
}

func HandlePolicyDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	policy := &oapi.Policy{}
	if err := json.Unmarshal(event.Data, policy); err != nil {
		return err
	}

	affectedTargets := getAffectedTargets(ctx, ws, policy.Id)

	ws.Policies().Remove(ctx, policy.Id)

	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

	releaseTargets, err := ws.ReleaseTargets().Items()
	if err == nil {
		enqueueAffectedTargets(ctx, ws, releaseTargets)
	}

	return nil
}
