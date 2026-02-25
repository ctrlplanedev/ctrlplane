package desiredrelease

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Setter interface {
	// SetDesiredRelease persists the release (creating it if necessary) and
	// sets it as the desired release on the release target.
	SetDesiredRelease(ctx context.Context, rt *ReleaseTarget, release *oapi.Release) error
}
