package deploymentplan

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// ErrTargetExists is returned by Setter.InsertTarget when the
// (planID, environmentID, resourceID) triple already exists.
var ErrTargetExists = errors.New("target already exists")

// Setter abstracts write and enqueue operations.
type Setter interface {
	CompletePlan(ctx context.Context, planID uuid.UUID) error
	InsertTarget(ctx context.Context, planID, envID, resourceID uuid.UUID) (uuid.UUID, error)
	InsertResult(ctx context.Context, targetID uuid.UUID, dispatchContext []byte) (uuid.UUID, error)
	EnqueueResult(ctx context.Context, workspaceID, resultID string) error
}
