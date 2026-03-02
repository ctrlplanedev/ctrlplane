package verification

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/action"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/releasemanager/action/verification")

// VerificationAction creates verifications based on policy rules
type VerificationAction struct {
	starter VerificationStarter
}

// NewVerificationAction creates a new verification action
func NewVerificationAction(starter VerificationStarter) *VerificationAction {
	return &VerificationAction{
		starter: starter,
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

	metrics := v.extractVerificationMetrics(trigger, actx.Policies)
	if len(metrics) == 0 {
		span.SetAttributes(attribute.Int("metric_count", 0))
		span.SetStatus(codes.Ok, "no metrics to create")
		return nil
	}

	span.SetAttributes(attribute.Int("metric_count", len(metrics)))

	if err := v.starter.StartVerification(ctx, actx.Job, metrics); err != nil {
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
	seen := make(map[string]bool)

	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			verificationRule := v.getVerificationRule(&rule)
			if verificationRule == nil {
				continue
			}

			if v.getTriggerFromRule(verificationRule) != trigger {
				continue
			}

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

// getVerificationRule extracts the verification rule from a policy rule
func (v *VerificationAction) getVerificationRule(rule *oapi.PolicyRule) *oapi.VerificationRule {
	return rule.Verification
}

// getTriggerFromRule determines the trigger for a verification rule
func (v *VerificationAction) getTriggerFromRule(rule *oapi.VerificationRule) action.ActionTrigger {
	if rule.TriggerOn == nil {
		return action.TriggerJobSuccess
	}

	switch *rule.TriggerOn {
	case oapi.JobCreated:
		return action.TriggerJobCreated
	case oapi.JobStarted:
		return action.TriggerJobStarted
	case oapi.JobSuccess:
		return action.TriggerJobSuccess
	case oapi.JobFailure:
		return action.TriggerJobFailure
	default:
		return action.TriggerJobSuccess
	}
}
