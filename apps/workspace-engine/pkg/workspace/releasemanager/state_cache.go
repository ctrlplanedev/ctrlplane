package releasemanager

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
)

// StateCache manages caching of release target states.
// It encapsulates all caching logic including cache misses, computation, and updates.
type StateCache struct {
	cache   *ristretto.Cache[string, *oapi.ReleaseTargetState]
	store   *store.Store
	planner *deployment.Planner
}

// NewStateCache creates a new state cache instance with a ristretto cache.
func NewStateCache(store *store.Store, planner *deployment.Planner) *StateCache {
	config := &ristretto.Config[string, *oapi.ReleaseTargetState]{
		NumCounters: 1e7,     // 10M keys
		MaxCost:     1 << 30, // 1GB
		BufferItems: 64,
	}
	cache, err := ristretto.NewCache(config)
	if err != nil {
		log.Warn("error creating release target state cache", "error", err.Error())
	}

	return &StateCache{
		cache:   cache,
		store:   store,
		planner: planner,
	}
}

type GetOption func(*GetOptions)

type GetOptions struct {
	resourceRelationships map[string][]*oapi.EntityRelation
}

func WithResourceRelationships(relationships map[string][]*oapi.EntityRelation) GetOption {
	return func(opts *GetOptions) {
		opts.resourceRelationships = relationships
	}
}

// Get retrieves a release target state from cache, computing it if not present.
// If resourceRelationships are provided, they will be passed to the planner to avoid recomputation.
func (sc *StateCache) Get(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...GetOption) (*oapi.ReleaseTargetState, error) {
	options := &GetOptions{}
	for _, opt := range opts {
		opt(options)
	}

	key := releaseTarget.Key()

	if state, ok := sc.cache.Get(key); ok {
		return state, nil
	}

	return sc.compute(ctx, releaseTarget, WithCachedRelationships(options.resourceRelationships))
}

// Set stores a release target state in the cache with a TTL.
func (sc *StateCache) Set(releaseTarget *oapi.ReleaseTarget, state *oapi.ReleaseTargetState) {
	sc.cache.SetWithTTL(releaseTarget.Key(), state, 1, 10*time.Minute)
}

// ComputeOption is a functional option for the Compute method.
type ComputeOption func(*computeOptions)

type computeOptions struct {
	desiredRelease *oapi.Release
	currentRelease *oapi.Release
	latestJob      *oapi.Job
	relationships  map[string][]*oapi.EntityRelation
}

// WithCachedRelationships provides the cached relationships to avoid recomputation.
func WithCachedRelationships(relationships map[string][]*oapi.EntityRelation) ComputeOption {
	return func(opts *computeOptions) {
		opts.relationships = relationships
	}
}

// WithDesiredRelease provides the desired release to avoid recomputation.
func WithDesiredRelease(release *oapi.Release) ComputeOption {
	return func(opts *computeOptions) {
		opts.desiredRelease = release
	}
}

// WithCurrentRelease provides the current release to avoid recomputation.
func WithCurrentRelease(release *oapi.Release) ComputeOption {
	return func(opts *computeOptions) {
		opts.currentRelease = release
	}
}

// WithLatestJob provides the latest job to avoid recomputation.
func WithLatestJob(job *oapi.Job) ComputeOption {
	return func(opts *computeOptions) {
		opts.latestJob = job
	}
}

// Compute computes the release target state from scratch and caches it.
// This involves gathering current release and job information.
// Callers can provide already-known information via options to avoid redundant queries.
func (sc *StateCache) compute(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...ComputeOption) (rts *oapi.ReleaseTargetState, err error) {
	options := &computeOptions{}
	for _, opt := range opts {
		opt(options)
	}

	// Get desired release (compute if not provided)
	desiredRelease := options.desiredRelease
	if desiredRelease == nil {
		if options.relationships != nil {
			desiredRelease, err = sc.planner.PlanDeployment(ctx, releaseTarget, deployment.WithResourceRelatedEntities(options.relationships))
			if err != nil {
				return nil, err
			}
		} else {
			desiredRelease, err = sc.planner.PlanDeployment(ctx, releaseTarget)
			if err != nil {
				return nil, err
			}
		}
	}

	// Get current release (compute if not provided)
	currentRelease := options.currentRelease
	if currentRelease == nil {
		cr, _, err := sc.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
		if err != nil {
			// No successful job found is not an error condition - it just means no current release
			log.Debug("no current release for release target", "error", err.Error())
		} else {
			currentRelease = cr
		}
	}

	// Get latest job (compute if not provided)
	latestJob := options.latestJob
	if latestJob == nil {
		latestJob, _ = sc.store.ReleaseTargets.GetLatestJob(ctx, releaseTarget)
	}

	rts = &oapi.ReleaseTargetState{
		DesiredRelease: desiredRelease,
		CurrentRelease: currentRelease,
		LatestJob:      latestJob,
	}

	sc.Set(releaseTarget, rts)

	return rts, nil
}
