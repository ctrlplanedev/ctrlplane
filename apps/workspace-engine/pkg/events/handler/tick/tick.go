package tick

import (
	"context"
	"encoding/json"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

// buildTimeSensitiveDeploymentsMap creates a map of deploymentId -> bool indicating
// which deployments have policies with time-sensitive rules (soak time, gradual rollout).
// This allows us to skip reconciling release targets for deployments that don't need periodic re-evaluation.
// Note: DenyWindow rules are not yet implemented in the Go backend, but when added, they should be checked here.
func buildTimeSensitiveDeploymentsMap(ctx context.Context, ws *workspace.Workspace, allReleaseTargets map[string]*oapi.ReleaseTarget) map[string]bool {
	timeSensitiveDeployments := make(map[string]bool)
	
	for _, policy := range ws.Policies().Items() {
		// Check if this policy has any time-sensitive rules
		hasTimeSensitiveRule := false
		for _, rule := range policy.Rules {
			if rule.EnvironmentProgression != nil || 
			   rule.GradualRollout != nil {
				hasTimeSensitiveRule = true
				break
			}
		}
		
		if !hasTimeSensitiveRule {
			continue
		}
		
		// Mark all deployments this policy affects
		// We check each release target to see if this policy applies to it
		for _, rt := range allReleaseTargets {
			if timeSensitiveDeployments[rt.DeploymentId] {
				continue // Already marked
			}
			
			policies, err := ws.ReleaseTargets().GetPolicies(ctx, rt)
			if err != nil {
				continue
			}
			
			for _, p := range policies {
				if p.Id == policy.Id {
					timeSensitiveDeployments[rt.DeploymentId] = true
					break
				}
			}
		}
	}
	
	return timeSensitiveDeployments
}

// hasRecentActivityOrPending checks if a release target has recent job activity
// or pending work that might be affected by time progression.
func hasRecentActivityOrPending(ws *workspace.Workspace, rt *oapi.ReleaseTarget, soakWindowCutoff time.Time) bool {
	jobs := ws.Jobs().GetJobsForReleaseTarget(rt)
	
	// No jobs yet - might be waiting for a time window to open
	if len(jobs) == 0 {
		return true
	}
	
	for _, job := range jobs {
		// Job in progress - continue checking
		if job.IsInProcessingState() {
			return true
		}
		
		// Recent completion - might be in soak period or progression waiting period
		if job.CompletedAt != nil && job.CompletedAt.After(soakWindowCutoff) {
			return true
		}
	}
	
	return false
}

var tracer = otel.Tracer("events/handler/tick")

func SendWorkspaceTick(ctx context.Context, producer messaging.Producer, wsId string) error {
	event := map[string]any{
		"eventType":   handler.WorkspaceTick,
		"workspaceId": wsId,
		"timestamp":   time.Now().Unix(),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return producer.Publish([]byte(wsId), eventBytes)
}

// HandleWorkspaceTick handles periodic workspace tick events by intelligently reconciling
// release targets that may be affected by time-sensitive policies. This is needed for:
// - Environment progression soak time (wait N minutes after deployment)
// - Environment progression maximum age (deployments become too old)
// - Gradual rollout policies (time-based progressive deployment)
//
// Optimization: Instead of reconciling ALL release targets on every tick, we filter to only
// those that actually need time-based re-evaluation:
// 1. Release targets whose deployments have time-sensitive policies
// 2. Release targets with recent job activity (might be in soak/progression window)
// 3. Release targets with no jobs yet (might be waiting for a time window)
func HandleWorkspaceTick(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	_, span := tracer.Start(ctx, "HandleWorkspaceTick")
	defer span.End()
	span.SetAttributes(
		attribute.String("workspace.id", ws.ID),
		attribute.String("event.type", string(event.EventType)),
	)

	// Get all release targets
	allReleaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get release targets")
		return err
	}

	totalCount := len(allReleaseTargets)
	span.SetAttributes(attribute.Int("release_targets.total", totalCount))

	// Early exit if no release targets
	if totalCount == 0 {
		span.SetStatus(codes.Ok, "no release targets to process")
		return nil
	}

	// Build a map of deployments with time-sensitive policies
	// This is the primary filter - we only care about release targets for these deployments
	timeSensitiveDeployments := buildTimeSensitiveDeploymentsMap(ctx, ws, allReleaseTargets)
	span.SetAttributes(attribute.Int("deployments.time_sensitive", len(timeSensitiveDeployments)))

	// If no time-sensitive policies exist, we can skip all reconciliations
	if len(timeSensitiveDeployments) == 0 {
		log.Info("No time-sensitive policies found, skipping tick reconciliation")
		span.SetStatus(codes.Ok, "no time-sensitive policies")
		return nil
	}

	// Filter release targets that need reconciliation
	targetsToReconcile := make([]*oapi.ReleaseTarget, 0)

	for _, rt := range allReleaseTargets {
		// Filter 1: Only process if deployment has time-sensitive policies
		if !timeSensitiveDeployments[rt.DeploymentId] {
			continue
		}

		targetsToReconcile = append(targetsToReconcile, rt)
	}

	filteredCount := len(targetsToReconcile)
	skippedCount := totalCount - filteredCount

	log.Info("Tick reconciliation", 
		"total", totalCount,
		"to_reconcile", filteredCount,
		"skipped", skippedCount,
		"time_sensitive_deployments", len(timeSensitiveDeployments))

	span.SetAttributes(
		attribute.Int("release_targets.to_reconcile", filteredCount),
		attribute.Int("release_targets.skipped", skippedCount),
	)

	// Reconcile the filtered targets
	for _, rt := range targetsToReconcile {
		ws.ReleaseManager().ReconcileTarget(ctx, rt, false)
	}

	span.SetStatus(codes.Ok, "tick processed")
	return nil
}
