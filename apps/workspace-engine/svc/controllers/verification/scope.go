package verification

import (
	"fmt"
	"strconv"
	"strings"
)

// VerificationMetricScope identifies a single metric within a verification
// record. The scope ID is encoded as "verificationID:metricIndex" in the
// reconcile work queue.
type VerificationMetricScope struct {
	VerificationID string
	MetricIndex    int
}

func ParseScope(scopeID string) (*VerificationMetricScope, error) {
	parts := strings.SplitN(scopeID, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid verification metric scope: %s", scopeID)
	}

	metricIndex, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid metric index %q: %w", parts[1], err)
	}

	return &VerificationMetricScope{
		VerificationID: parts[0],
		MetricIndex:    metricIndex,
	}, nil
}
