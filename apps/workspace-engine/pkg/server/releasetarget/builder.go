package releasetarget

import (
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// ReleaseTargetBuilder provides a fluent API for building release targets
type ReleaseTargetBuilder struct {
	resource    *pb.Resource
	environment *pb.Environment
	deployment  *pb.Deployment
}

// NewReleaseTargetBuilder creates a new release target builder
func NewReleaseTargetBuilder() *ReleaseTargetBuilder {
	return &ReleaseTargetBuilder{}
}

// ForResource sets the resource for this release target
func (b *ReleaseTargetBuilder) ForResource(resource *pb.Resource) *ReleaseTargetBuilder {
	b.resource = resource
	return b
}

// InEnvironment sets the environment for this release target
func (b *ReleaseTargetBuilder) InEnvironment(env *pb.Environment) *ReleaseTargetBuilder {
	b.environment = env
	return b
}

// WithDeployment sets the deployment for this release target
func (b *ReleaseTargetBuilder) WithDeployment(dep *pb.Deployment) *ReleaseTargetBuilder {
	b.deployment = dep
	return b
}

// Build constructs the final release target
func (b *ReleaseTargetBuilder) Build() *pb.ReleaseTarget {
	return &pb.ReleaseTarget{
		Id:            uuid.New().String(),
		ResourceId:    b.resource.Id,
		EnvironmentId: b.environment.Id,
		DeploymentId:  b.deployment.Id,
		Environment:   b.environment,
		Deployment:    b.deployment,
	}
}

