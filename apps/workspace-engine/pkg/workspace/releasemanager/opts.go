package releasemanager

import (
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

// options is a unified options struct for all releasemanager methods
type options struct {
	skipEligibilityCheck bool
	trigger              trace.TriggerReason
}

type Option func(*options)

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
