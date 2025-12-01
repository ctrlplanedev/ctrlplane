package releasemanager

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"
)

type releasemanagerVerificationHooks struct {
	statecache *StateCache
	store      *store.Store
}

var _ verification.VerificationHooks = &releasemanagerVerificationHooks{}

func newReleaseManagerVerificationHooks(store *store.Store, statecache *StateCache) *releasemanagerVerificationHooks {
	return &releasemanagerVerificationHooks{
		store:      store,
		statecache: statecache,
	}
}

func (h *releasemanagerVerificationHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return nil
}

func (h *releasemanagerVerificationHooks) OnMetricComplete(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int) error {
	return nil
}

func (h *releasemanagerVerificationHooks) OnVerificationStarted(ctx context.Context, verification *oapi.ReleaseVerification) error {
	return nil
}

func (h *releasemanagerVerificationHooks) OnVerificationComplete(ctx context.Context, verification *oapi.ReleaseVerification) error {
	release, ok := h.store.Releases.Get(verification.ReleaseId)
	if !ok {
		return fmt.Errorf("release not found")
	}

	h.statecache.Invalidate(&release.ReleaseTarget)
	return nil
}

func (h *releasemanagerVerificationHooks) OnVerificationStopped(ctx context.Context, verification *oapi.ReleaseVerification) error {
	return nil
}
