package releasemanager

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"
)

type releasemanagerVerificationHooks struct {
	stateIndex *StateIndex
	store      *store.Store
}

var _ verification.VerificationHooks = &releasemanagerVerificationHooks{}

func newReleaseManagerVerificationHooks(store *store.Store, stateIndex *StateIndex) *releasemanagerVerificationHooks {
	return &releasemanagerVerificationHooks{
		store:      store,
		stateIndex: stateIndex,
	}
}

func (h *releasemanagerVerificationHooks) dirtyStateForVerification(ctx context.Context, verification *oapi.JobVerification) error {
	job, ok := h.store.Jobs.Get(verification.JobId)
	if !ok {
		return fmt.Errorf("job not found")
	}

	release, ok := h.store.Releases.Get(job.ReleaseId)
	if !ok {
		return fmt.Errorf("release not found")
	}

	h.stateIndex.DirtyCurrentAndJob(release.ReleaseTarget)
	h.stateIndex.Recompute(ctx)
	return nil
}

func (h *releasemanagerVerificationHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return h.dirtyStateForVerification(ctx, verification)
}

func (h *releasemanagerVerificationHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error {
	return h.dirtyStateForVerification(ctx, verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error {
	return h.dirtyStateForVerification(ctx, verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error {
	return h.dirtyStateForVerification(ctx, verification)
}

func (h *releasemanagerVerificationHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error {
	return h.dirtyStateForVerification(ctx, verification)
}
