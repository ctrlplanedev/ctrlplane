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

// SystemRepo defines the contract for system storage.
type SystemRepo interface {
	Get(id string) (*oapi.System, bool)
	Set(entity *oapi.System) error
	Remove(id string) error
	Items() map[string]*oapi.System
}
