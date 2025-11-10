package action

import (
	"context"
	"workspace-engine/pkg/oapi"
)

// ActionTrigger represents when an action should execute
type ActionTrigger string

const (
	TriggerJobCreated ActionTrigger = "job.created"
	TriggerJobStarted ActionTrigger = "job.started"
	TriggerJobSuccess ActionTrigger = "job.success"
	TriggerJobFailure ActionTrigger = "job.failure"
)

// ActionContext provides context for action execution
type ActionContext struct {
	Job      *oapi.Job
	Release  *oapi.Release
	Policies []*oapi.Policy
}

// PolicyAction executes actions triggered by deployment lifecycle events
// Examples: verification creation, webhooks, notifications
type PolicyAction interface {
	// Name returns the action identifier (e.g., "verification", "webhook")
	Name() string

	// Execute performs the action for a specific trigger
	// Should fail fast (return nil) if action doesn't apply to the trigger/policies
	Execute(ctx context.Context, trigger ActionTrigger, context ActionContext) error
}

