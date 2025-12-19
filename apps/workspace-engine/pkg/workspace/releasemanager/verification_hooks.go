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

func (h *releasemanagerVerificationHooks) invalidateCacheForVerification(verification *oapi.JobVerification) error {
	job, ok := h.store.Jobs.Get(verification.JobId)
	if !ok {
		return fmt.Errorf("job not found")
	}

	release, ok := h.store.Releases.Get(job.ReleaseId)
	if !ok {
		return fmt.Errorf("release not found")
	}

	h.statecache.Invalidate(&release.ReleaseTarget)
	return nil
}

func (h *releasemanagerVerificationHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return h.invalidateCacheForVerification(verification)
}

func (h *releasemanagerVerificationHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error {
	return h.invalidateCacheForVerification(verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error {
	return h.invalidateCacheForVerification(verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error {
	return h.invalidateCacheForVerification(verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error {
	return h.invalidateCacheForVerification(verification)
}
