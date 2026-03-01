package verification

import (
	"context"

	"workspace-engine/pkg/oapi"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct{}

// RecordMeasurement implements [Setter].
func (s *PostgresSetter) RecordMeasurement(ctx context.Context, verificationID string, metricIndex int, measurement oapi.VerificationMeasurement) error {
	panic("unimplemented")
}

// UpdateVerificationMessage implements [Setter].
func (s *PostgresSetter) UpdateVerificationMessage(ctx context.Context, verificationID string, message string) error {
	panic("unimplemented")
}

// EnqueueDesiredRelease implements [Setter].
func (s *PostgresSetter) EnqueueDesiredRelease(ctx context.Context, workspaceID string, rt *ReleaseTarget) error {
	panic("unimplemented")
}
