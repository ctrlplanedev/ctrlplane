package jobdispatch

import (
	"context"

	"workspace-engine/pkg/oapi"
)

// Dispatcher sends a created job to its external execution system
// (ArgoCD, GitHub Actions, Terraform Cloud, etc.).
// *jobagents.Registry satisfies this interface.
type Dispatcher interface {
	Dispatch(ctx context.Context, job *oapi.Job) error
}

// AgentVerifier resolves verification specs that an agent type declares
// via the [types.Verifiable] interface. *jobagents.Registry satisfies this.
type AgentVerifier interface {
	AgentVerifications(agentType string, config oapi.JobAgentConfig) ([]oapi.VerificationMetricSpec, error)
}

// Restorable is optionally implemented by a Dispatcher to re-establish
// in-flight jobs after a process restart. Agents whose execution is driven
// by in-process state (e.g. test-runner timers) implement this so the
// controller can revive them on startup.
type Restorable interface {
	Restore(ctx context.Context, job *oapi.Job) error
}
