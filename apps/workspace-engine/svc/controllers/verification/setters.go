package verification

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Setter interface {
	// RecordMeasurement appends a measurement to the specified metric within
	// the verification record.
	RecordMeasurement(ctx context.Context, verificationID string, metricIndex int, measurement oapi.VerificationMeasurement) error

	// UpdateVerificationMessage sets the summary message on the verification record.
	UpdateVerificationMessage(ctx context.Context, verificationID string, message string) error

	// EnqueueDesiredRelease enqueues a desired-release reconcile item for the
	// given release target so the desiredrelease controller re-evaluates
	// whether the release is complete.
	EnqueueDesiredRelease(ctx context.Context, workspaceID string, rt *ReleaseTarget) error
}
