package releasemanager

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reactiveindex/computeindex"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
)

var stateIndexTracer = otel.Tracer("StateIndex")

// StateIndex manages release target state as three independent ComputedIndexes,
// each with its own compute function and dirty tracking. This replaces the
// monolithic StateCache so that changes only recompute the affected components.
type StateIndex struct {
	store   *store.Store
	planner *deployment.Planner

	desiredRelease *computeindex.ComputedIndex[*oapi.Release]
	currentRelease *computeindex.ComputedIndex[*oapi.Release]
	latestJob      *computeindex.ComputedIndex[*oapi.JobWithVerifications]
}

// NewStateIndex creates a new StateIndex with three independent ComputedIndexes.
func NewStateIndex(s *store.Store, planner *deployment.Planner) *StateIndex {
	si := &StateIndex{
		store:   s,
		planner: planner,
	}

	si.desiredRelease = computeindex.New(si.computeDesiredRelease)
	si.currentRelease = computeindex.New(si.computeCurrentRelease)
	si.latestJob = computeindex.New(si.computeLatestJob)

	return si
}

// computeDesiredRelease is the ComputeFunc for the desiredRelease index.
// It resolves the release target by key and runs the deployment planner.
func (si *StateIndex) computeDesiredRelease(ctx context.Context, key string) (*oapi.Release, error) {
	ctx, span := stateIndexTracer.Start(ctx, "StateIndex.computeDesiredRelease")
	defer span.End()

	rt := si.store.ReleaseTargets.Get(key)
	if rt == nil {
		return nil, fmt.Errorf("release target %q not found", key)
	}

	release, err := si.planner.PlanDeployment(ctx, rt)
	if err != nil {
		return nil, err
	}

	return release, nil
}

// computeCurrentRelease is the ComputeFunc for the currentRelease index.
// It resolves the release target by key and fetches the current release from the store.
func (si *StateIndex) computeCurrentRelease(ctx context.Context, key string) (*oapi.Release, error) {
	ctx, span := stateIndexTracer.Start(ctx, "StateIndex.computeCurrentRelease")
	defer span.End()

	rt := si.store.ReleaseTargets.Get(key)
	if rt == nil {
		return nil, fmt.Errorf("release target %q not found", key)
	}

	release, _, err := si.store.ReleaseTargets.GetCurrentRelease(ctx, rt)
	if err != nil {
		log.Debug("no current release for release target", "key", key, "error", err.Error())
		return nil, nil
	}

	return release, nil
}

// computeLatestJob is the ComputeFunc for the latestJob index.
// It resolves the release target by key, fetches the latest job, and attaches verifications.
func (si *StateIndex) computeLatestJob(ctx context.Context, key string) (*oapi.JobWithVerifications, error) {
	ctx, span := stateIndexTracer.Start(ctx, "StateIndex.computeLatestJob")
	defer span.End()

	rt := si.store.ReleaseTargets.Get(key)
	if rt == nil {
		return nil, fmt.Errorf("release target %q not found", key)
	}

	job, err := si.store.ReleaseTargets.GetLatestJob(ctx, rt)
	if err != nil {
		log.Debug("no latest job for release target", "key", key, "error", err.Error())
		return nil, nil
	}

	return si.jobWithVerifications(job), nil
}

// jobWithVerifications attaches verification records to a job.
func (si *StateIndex) jobWithVerifications(job *oapi.Job) *oapi.JobWithVerifications {
	if job == nil {
		return nil
	}

	verifications := si.store.JobVerifications.GetByJobId(job.Id)
	slice := make([]oapi.JobVerification, 0, len(verifications))
	for _, v := range verifications {
		if v == nil {
			continue
		}
		slice = append(slice, *v)
	}

	return &oapi.JobWithVerifications{
		Job:           *job,
		Verifications: slice,
	}
}

// --- Entity lifecycle ---

// AddEntity registers a release target key across all three indexes.
func (si *StateIndex) AddReleaseTarget(key oapi.ReleaseTarget) {
	si.desiredRelease.AddEntity(key.Key())
	si.currentRelease.AddEntity(key.Key())
	si.latestJob.AddEntity(key.Key())
}

// RemoveEntity removes a release target key from all three indexes.
func (si *StateIndex) RemoveReleaseTarget(rt oapi.ReleaseTarget) {
	si.desiredRelease.RemoveEntity(rt.Key())
	si.currentRelease.RemoveEntity(rt.Key())
	si.latestJob.RemoveEntity(rt.Key())
}

// --- Dirty (write path) ---

// DirtyDesired marks only the desired release for recompute.
// Use when versions, policies, or resource relationships change.
func (si *StateIndex) DirtyDesired(rt oapi.ReleaseTarget) {
	si.desiredRelease.DirtyEntity(rt.Key())
}

// DirtyCurrentAndJob marks the current release and latest job for recompute.
// Use when verification hooks fire or job status changes — these don't affect
// the desired release, which is expensive to recompute.
func (si *StateIndex) DirtyCurrentAndJob(rt oapi.ReleaseTarget) {
	si.currentRelease.DirtyEntity(rt.Key())
	si.latestJob.DirtyEntity(rt.Key())
}

// DirtyAll marks all three indexes dirty for a key, forcing a full recompute.
// Use after reconciliation or when all components may have changed.
func (si *StateIndex) DirtyAll(rt oapi.ReleaseTarget) {
	si.desiredRelease.DirtyEntity(rt.Key())
	si.currentRelease.DirtyEntity(rt.Key())
	si.latestJob.DirtyEntity(rt.Key())
}

// --- Read path ---

// GetDesiredRelease returns the cached desired release for a release target.
func (si *StateIndex) GetDesiredRelease(rt oapi.ReleaseTarget) *oapi.Release {
	desired, _ := si.desiredRelease.Get(rt.Key())
	return desired
}

// isComputed checks whether a release target has been registered and computed
// in the state index. It uses the desiredRelease index as a proxy — all three
// indexes are registered/removed together.
func (si *StateIndex) isComputed(rt oapi.ReleaseTarget) bool {
	_, ok := si.desiredRelease.Get(rt.Key())
	return ok
}

// ensureComputed lazily registers and computes a release target if it has not
// been seen before. This handles release targets that exist in the store but
// were loaded outside of ProcessChanges (e.g. persisted state on restart).
func (si *StateIndex) ensureComputed(ctx context.Context, rt oapi.ReleaseTarget) {
	if si.isComputed(rt) {
		return
	}
	si.AddReleaseTarget(rt) // registers + marks dirty
	si.Recompute(ctx)
}

// Get assembles a composite ReleaseTargetState from the three indexes.
func (si *StateIndex) Get(ctx context.Context, rt oapi.ReleaseTarget) *oapi.ReleaseTargetState {
	si.ensureComputed(ctx, rt)

	desired, _ := si.desiredRelease.Get(rt.Key())
	current, _ := si.currentRelease.Get(rt.Key())
	latest, _ := si.latestJob.Get(rt.Key())

	return &oapi.ReleaseTargetState{
		DesiredRelease: desired,
		CurrentRelease: current,
		LatestJob:      latest,
	}
}

// --- Recompute ---

// RecomputeEntity forces a full recompute for a single entity.
// Use for bypass-cache scenarios where fresh state is needed immediately.
// Uses AddReleaseTarget (not DirtyAll) to ensure the entity is registered
// — DirtyEntity silently no-ops for unregistered entities.
func (si *StateIndex) RecomputeEntity(ctx context.Context, rt oapi.ReleaseTarget) {
	si.AddReleaseTarget(rt)
	si.Recompute(ctx)
}

// Recompute processes dirty entities across all three indexes.
// Returns the total number of evaluations performed.
func (si *StateIndex) Recompute(ctx context.Context) int {
	ctx, span := stateIndexTracer.Start(ctx, "StateIndex.Recompute")
	defer span.End()

	n := si.desiredRelease.Recompute(ctx)
	n += si.currentRelease.Recompute(ctx)
	n += si.latestJob.Recompute(ctx)

	return n
}
