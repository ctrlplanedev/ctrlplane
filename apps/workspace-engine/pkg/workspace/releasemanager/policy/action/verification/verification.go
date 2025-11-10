package verification

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/action"
	"workspace-engine/pkg/workspace/releasemanager/verification"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/action/verification")

// VerificationAction creates verifications based on policy rules
type VerificationAction struct {
	verificationManager *verification.Manager
}

// NewVerificationAction creates a new verification action
func NewVerificationAction(manager *verification.Manager) *VerificationAction {
	return &VerificationAction{
		verificationManager: manager,
	}
}

// Name returns the action identifier
func (v *VerificationAction) Name() string {
	return "verification"
}

// Execute creates a verification for the release
// Fails fast by returning nil if no metrics match the trigger
func (v *VerificationAction) Execute(
	ctx context.Context,
	trigger action.ActionTrigger,
	actx action.ActionContext,
) error {
	ctx, span := tracer.Start(ctx, "VerificationAction.Execute")
	defer span.End()

	span.SetAttributes(
		attribute.String("trigger", string(trigger)),
		attribute.String("release.id", actx.Release.ID()),
		attribute.String("job.id", actx.Job.Id))

	// Extract all verification metrics from matching policies
	metrics := v.extractVerificationMetrics(trigger, actx.Policies)
	if len(metrics) == 0 {
		span.SetAttributes(attribute.Int("metric_count", 0))
		span.SetStatus(codes.Ok, "no metrics to create")
		return nil
	}

	span.SetAttributes(attribute.Int("metric_count", len(metrics)))

	// Create verification synchronously
	if err := v.verificationManager.StartVerification(ctx, actx.Release, metrics); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create verification")
		log.Error("Failed to create verification",
			"error", err,
			"release_id", actx.Release.ID(),
			"job_id", actx.Job.Id,
			"trigger", trigger)
		return err
	}

	span.SetStatus(codes.Ok, "verification created")
	log.Info("Created verification from policy action",
		"release_id", actx.Release.ID(),
		"job_id", actx.Job.Id,
		"trigger", trigger,
		"metric_count", len(metrics))

	return nil
}

// extractVerificationMetrics extracts and deduplicates verification metrics from policies
func (v *VerificationAction) extractVerificationMetrics(
	trigger action.ActionTrigger,
	policies []*oapi.Policy,
) []oapi.VerificationMetricSpec {
	var allMetrics []oapi.VerificationMetricSpec
	seen := make(map[string]bool) // Deduplicate by metric name

	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			verificationRule := v.getVerificationRule(&rule)
			if verificationRule == nil {
				continue
			}

			// Check if this verification rule matches the trigger
			if v.getTriggerFromRule(verificationRule) != trigger {
				continue
			}

			// Add metrics (deduplicate by name)
			for _, metric := range verificationRule.Metrics {
				if !seen[metric.Name] {
					allMetrics = append(allMetrics, metric)
					seen[metric.Name] = true
				}
			}
		}
	}

	return allMetrics
}

// VerificationRule represents the verification configuration in a policy rule
// Note: This will be added to oapi.PolicyRule once the OpenAPI schema is updated
type VerificationRule struct {
	TriggerOn *string                       `json:"triggerOn,omitempty"`
	Metrics   []oapi.VerificationMetricSpec `json:"metrics"`
}

// getVerificationRule extracts the verification rule from a policy rule
// TODO: Once oapi.PolicyRule has a Verification field, update this to use it directly
func (v *VerificationAction) getVerificationRule(rule *oapi.PolicyRule) *VerificationRule {
	// Placeholder: This will be replaced with rule.Verification once OpenAPI schema is updated
	// For now, return nil to indicate no verification rules exist
	_ = rule
	return nil
}

// getTriggerFromRule determines the trigger for a verification rule
func (v *VerificationAction) getTriggerFromRule(rule *VerificationRule) action.ActionTrigger {
	if rule.TriggerOn == nil {
		return action.TriggerJobSuccess // Default
	}

	switch *rule.TriggerOn {
	case "jobCreated":
		return action.TriggerJobCreated
	case "jobStarted":
		return action.TriggerJobStarted
	case "jobSuccess":
		return action.TriggerJobSuccess
	case "jobFailure":
		return action.TriggerJobFailure
	default:
		return action.TriggerJobSuccess
	}
}

