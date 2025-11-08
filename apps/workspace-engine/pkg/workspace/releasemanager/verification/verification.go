package verification

import (
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics"
)

// Verification represents the verification configuration and state
type Verification struct {
	// Config  *oapi.VerificationRule
	Metric  *metrics.Metric
}
