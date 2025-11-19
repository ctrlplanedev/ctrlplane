package releasemanager

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

// options is a unified options struct for all releasemanager methods
type options struct {
	// ReleaseManager options
	skipEligibilityCheck         bool
	trigger                      trace.TriggerReason
	resourceRelationships        map[string][]*oapi.EntityRelation
	earliestVersionForEvaluation *oapi.DeploymentVersion

	// StateCache options
	bypassCache    bool
	desiredRelease *oapi.Release
	currentRelease *oapi.Release
	latestJob      *oapi.Job
}

type Option func(*options)

// ReleaseManager options

func WithSkipEligibilityCheck(skip bool) Option {
	return func(opts *options) {
		opts.skipEligibilityCheck = skip
	}
}

func WithTrigger(trigger trace.TriggerReason) Option {
	return func(opts *options) {
		opts.trigger = trigger
	}
}

func WithVersionAndNewer(version *oapi.DeploymentVersion) Option {
	return func(opts *options) {
		opts.earliestVersionForEvaluation = version
	}
}

// StateCache options

func WithResourceRelationships(relationships map[string][]*oapi.EntityRelation) Option {
	return func(opts *options) {
		opts.resourceRelationships = relationships
	}
}

// WithBypassCache forces a fresh computation, bypassing the cache.
func WithBypassCache() Option {
	return func(opts *options) {
		opts.bypassCache = true
	}
}

// WithDesiredRelease provides the desired release to avoid recomputation.
func WithDesiredRelease(release *oapi.Release) Option {
	return func(opts *options) {
		opts.desiredRelease = release
	}
}

// WithCurrentRelease provides the current release to avoid recomputation.
func WithCurrentRelease(release *oapi.Release) Option {
	return func(opts *options) {
		opts.currentRelease = release
	}
}

// WithLatestJob provides the latest job to avoid recomputation.
func WithLatestJob(job *oapi.Job) Option {
	return func(opts *options) {
		opts.latestJob = job
	}
}
