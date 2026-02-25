package policies

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"encoding/json"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("events/handler/policies")

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

	// Get all release targets affected by this new policy and trigger reconciliation
	// This ensures that newly created policies can block previously allowed deployments
	releaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		return err
	}

	affectedTargets := make([]*oapi.ReleaseTarget, 0)
	for _, rt := range releaseTargets {
		// Check if this new policy applies to this release target
		policies, err := ws.ReleaseTargets().GetPolicies(ctx, rt)
		if err != nil {
			continue
		}
		for _, p := range policies {
			if p.Id == policy.Id {
				affectedTargets = append(affectedTargets, rt)
				break
			}
		}
	}

	// Mark desired release dirty for affected targets so planning phase re-evaluates
	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	// Reconcile all affected targets to re-evaluate with the new policy
	log.Info("Policy created - reconciling affected targets",
		"policy_id", policy.Id,
		"affected_targets_count", len(affectedTargets))
	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

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

	// Get all release targets affected by this policy and trigger reconciliation
	// This ensures that when a policy is enabled/disabled or its rules change,
	// any blocked deployments can proceed or new deployments get blocked
	_, getTargetsSpan := tracer.Start(ctx, "GetReleaseTargets")
	releaseTargets, err := ws.ReleaseTargets().Items()
	getTargetsSpan.End()
	if err != nil {
		return err
	}

	_, getAffectedTargetsSpan := tracer.Start(ctx, "GetAffectedTargets")
	affectedTargets := make([]*oapi.ReleaseTarget, 0)
	for _, rt := range releaseTargets {
		// Check if this policy applies to this release target
		policies, err := ws.ReleaseTargets().GetPolicies(ctx, rt)
		if err != nil {
			continue
		}
		for _, p := range policies {
			if p.Id == policy.Id {
				affectedTargets = append(affectedTargets, rt)
				break
			}
		}
	}
	getAffectedTargetsSpan.End()

	_, dirtyDesiredReleaseSpan := tracer.Start(ctx, "DirtyDesiredRelease")
	// Mark desired release dirty for affected targets so planning phase re-evaluates
	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	dirtyDesiredReleaseSpan.End()

	_, recomputeStateSpan := tracer.Start(ctx, "RecomputeState")
	ws.ReleaseManager().RecomputeState(ctx)
	recomputeStateSpan.End()

	// Reconcile all affected targets to re-evaluate with the updated policy
	log.Info("Policy updated - reconciling affected targets",
		"policy_id", policy.Id,
		"policy_enabled", policy.Enabled,
		"affected_targets_count", len(affectedTargets))
	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

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

	// Get affected targets BEFORE removing the policy
	releaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		return err
	}

	affectedTargets := make([]*oapi.ReleaseTarget, 0)
	for _, rt := range releaseTargets {
		// Check if this policy was applying to this release target
		policies, err := ws.ReleaseTargets().GetPolicies(ctx, rt)
		if err != nil {
			continue
		}
		for _, p := range policies {
			if p.Id == policy.Id {
				affectedTargets = append(affectedTargets, rt)
				break
			}
		}
	}

	// Now remove the policy
	ws.Policies().Remove(ctx, policy.Id)

	// Mark desired release dirty for affected targets so planning phase re-evaluates
	for _, rt := range affectedTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	// Reconcile all affected targets so previously blocked deployments can proceed
	_ = ws.ReleaseManager().ReconcileTargets(ctx, affectedTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated))

	return nil
}
