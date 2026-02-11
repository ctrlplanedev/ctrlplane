package repository

import "workspace-engine/pkg/oapi"

// DeploymentVersionRepo defines the contract for deployment version storage.
// Implementations include the in-memory indexstore and the DB-backed store.
type DeploymentVersionRepo interface {
	Get(id string) (*oapi.DeploymentVersion, bool)
	GetBy(index string, args ...any) ([]*oapi.DeploymentVersion, error)
	Set(entity *oapi.DeploymentVersion) error
	Remove(id string) error
	Items() map[string]*oapi.DeploymentVersion
}
