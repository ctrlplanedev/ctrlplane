package releasemanager

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var stateCacheTracer = otel.Tracer("StateCache")

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

// Get retrieves a release target state from cache, computing it if not present.
// If resourceRelationships are provided, they will be passed to the planner to avoid recomputation.
// If bypassCache is true, always computes fresh state.
func (sc *StateCache) Get(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...Option) (*oapi.ReleaseTargetState, error) {
	ctx, span := stateCacheTracer.Start(ctx, "ReleaseManager.StateCache.Get")
	defer span.End()

	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	key := releaseTarget.Key()

	span.SetAttributes(attribute.Bool("bypass_cache", options.bypassCache))
	span.SetAttributes(attribute.String("release_target.key", key))

	// Check cache unless bypass is requested
	if !options.bypassCache {
		if state, ok := sc.cache.Get(key); ok {
			return state, nil
		}
	}

	return sc.compute(ctx, releaseTarget, WithResourceRelationships(options.resourceRelationships))
}

// Set stores a release target state in the cache with a TTL.
func (sc *StateCache) Set(releaseTarget *oapi.ReleaseTarget, state *oapi.ReleaseTargetState) {
	sc.cache.SetWithTTL(releaseTarget.Key(), state, 1, 10*time.Minute)
}

// Invalidate removes a release target state from the cache.
func (sc *StateCache) Invalidate(releaseTarget *oapi.ReleaseTarget) {
	sc.cache.Del(releaseTarget.Key())
}

func (sc *StateCache) getJobWithVerifications(job *oapi.Job) *oapi.JobWithVerifications {
	if job == nil {
		return nil
	}
	verifications := sc.store.JobVerifications.GetByJobId(job.Id)
	verificationsSlice := make([]oapi.JobVerification, 0, len(verifications))
	for _, verification := range verifications {
		if verification == nil {
			continue
		}
		verificationsSlice = append(verificationsSlice, *verification)
	}
	return &oapi.JobWithVerifications{
		Job:           *job,
		Verifications: verificationsSlice,
	}
}

// compute computes the release target state from scratch and caches it.
// This involves gathering current release and job information.
// Callers can provide already-known information via options to avoid redundant queries.
func (sc *StateCache) compute(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...Option) (rts *oapi.ReleaseTargetState, err error) {
	ctx, span := stateCacheTracer.Start(ctx, "ReleaseManager.StateCache.compute")
	defer span.End()

	span.SetAttributes(attribute.String("release_target.key", releaseTarget.Key()))

	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	// Get desired release (compute if not provided)
	desiredRelease := options.desiredRelease
	if desiredRelease == nil {
		if options.resourceRelationships != nil {
			desiredRelease, err = sc.planner.PlanDeployment(ctx, releaseTarget, deployment.WithResourceRelatedEntities(options.resourceRelationships))
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
		_, currentReleaseSpan := stateCacheTracer.Start(ctx, "GetCurrentRelease")

		cr, _, err := sc.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
		if err != nil {
			// No successful job found is not an error condition - it just means no current release
			log.Debug("no current release for release target", "error", err.Error())
		} else {
			currentRelease = cr
		}
		currentReleaseSpan.End()
	}

	// Get latest job (compute if not provided)
	latestJob := options.latestJob
	if latestJob == nil {
		latestJob, _ = sc.store.ReleaseTargets.GetLatestJob(ctx, releaseTarget)
	}

	latestJobWithVerifications := sc.getJobWithVerifications(latestJob)
	rts = &oapi.ReleaseTargetState{
		DesiredRelease: desiredRelease,
		CurrentRelease: currentRelease,
		LatestJob:      latestJobWithVerifications,
	}

	sc.Set(releaseTarget, rts)

	return rts, nil
}
