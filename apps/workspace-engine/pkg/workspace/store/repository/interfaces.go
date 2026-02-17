package repository

import "workspace-engine/pkg/oapi"

// DeploymentVersionRepo defines the contract for deployment version storage.
// Implementations include the in-memory indexstore and the DB-backed store.
type DeploymentVersionRepo interface {
	Get(id string) (*oapi.DeploymentVersion, bool)
	GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error)
	Set(entity *oapi.DeploymentVersion) error
	Remove(id string) error
	Items() map[string]*oapi.DeploymentVersion
}

// DeploymentRepo defines the contract for deployment storage.
type DeploymentRepo interface {
	Get(id string) (*oapi.Deployment, bool)
	Set(entity *oapi.Deployment) error
	Remove(id string) error
	Items() map[string]*oapi.Deployment
}

// EnvironmentRepo defines the contract for environment storage.
type EnvironmentRepo interface {
	Get(id string) (*oapi.Environment, bool)
	Set(entity *oapi.Environment) error
	Remove(id string) error
	Items() map[string]*oapi.Environment
}

// SystemDeploymentRepo manages system <-> deployment associations.
type SystemDeploymentRepo interface {
	GetSystemIDsForDeployment(deploymentID string) []string
	GetDeploymentIDsForSystem(systemID string) []string
	Link(systemID, deploymentID string) error
	Unlink(systemID, deploymentID string) error
}

// SystemEnvironmentRepo manages system <-> environment associations.
type SystemEnvironmentRepo interface {
	GetSystemIDsForEnvironment(environmentID string) []string
	GetEnvironmentIDsForSystem(systemID string) []string
	Link(systemID, environmentID string) error
	Unlink(systemID, environmentID string) error
}

// SystemRepo defines the contract for system storage.
type SystemRepo interface {
	Get(id string) (*oapi.System, bool)
	Set(entity *oapi.System) error
	Remove(id string) error
	Items() map[string]*oapi.System
}

// JobAgentRepo defines the contract for job agent storage.
type JobAgentRepo interface {
	Get(id string) (*oapi.JobAgent, bool)
	Set(entity *oapi.JobAgent) error
	Remove(id string) error
	Items() map[string]*oapi.JobAgent
}

// ResourceRepo defines the contract for resource storage.
type ResourceRepo interface {
	Get(id string) (*oapi.Resource, bool)
	GetByIdentifier(identifier string) (*oapi.Resource, bool)
	GetByIdentifiers(identifiers []string) map[string]*oapi.Resource
	ListByProviderID(providerID string) []*oapi.Resource
	Set(entity *oapi.Resource) error
	SetBatch(entities []*oapi.Resource) error
	Remove(id string) error
	RemoveBatch(ids []string) error
	Items() map[string]*oapi.Resource
}

// ResourceProviderRepo defines the contract for resource provider storage.
type ResourceProviderRepo interface {
	Get(id string) (*oapi.ResourceProvider, bool)
	Set(entity *oapi.ResourceProvider) error
	Remove(id string) error
	Items() map[string]*oapi.ResourceProvider
}

// ReleaseRepo defines the contract for release storage.
type ReleaseRepo interface {
	Get(id string) (*oapi.Release, bool)
	GetByReleaseTargetKey(key string) ([]*oapi.Release, error)
	Set(entity *oapi.Release) error
	Remove(id string) error
	Items() map[string]*oapi.Release
}
