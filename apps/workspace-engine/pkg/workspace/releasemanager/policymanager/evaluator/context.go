package evaluator

import (
	"time"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"
)

// EvaluationContext contains all the information needed to evaluate policy rules.
// It provides a comprehensive view of the deployment attempt being evaluated.
type EvaluationContext struct {
	store *store.Store

	// The deployment version being evaluated
	Version *pb.DeploymentVersion

	// The release target (deployment + environment + resource)
	ReleaseTarget *pb.ReleaseTarget

	// The policy being evaluated
	Policy *pb.Policy

	// Current time for time-based rules (injectable for testing)
	Now time.Time

	// Additional metadata that rules might need
	Metadata map[string]any
}

// NewEvaluationContext creates a new evaluation context with the current time.
func NewEvaluationContext(
	store *store.Store,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
	policy *pb.Policy,
) *EvaluationContext {
	return &EvaluationContext{
		store:         store,
		Version:       version,
		ReleaseTarget: releaseTarget,
		Policy:        policy,
		Now:           time.Now(),
		Metadata:      make(map[string]interface{}),
	}
}

func (c *EvaluationContext) Deployment() *pb.Deployment {
	deployment, _ := c.store.Deployments.Get(c.ReleaseTarget.DeploymentId)
	return deployment
}

func (c *EvaluationContext) Environment() *pb.Environment {
	environment, _ := c.store.Environments.Get(c.ReleaseTarget.EnvironmentId)
	return environment
}

func (c *EvaluationContext) Resource() *pb.Resource {
	resource, _ := c.store.Resources.Get(c.ReleaseTarget.ResourceId)
	return resource
}