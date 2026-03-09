package desiredrelease

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
)

type upsertRuleEvaluationsSetter = policies.UpsertRuleEvaluations

type Setter interface {
	upsertRuleEvaluationsSetter

	// SetDesiredRelease persists the release (creating it if necessary) and
	// sets it as the desired release on the release target.
	SetDesiredRelease(ctx context.Context, rt *ReleaseTarget, release *oapi.Release) error

	EnqueueJobEligibility(ctx context.Context, workspaceID string, rt *ReleaseTarget) error
}
