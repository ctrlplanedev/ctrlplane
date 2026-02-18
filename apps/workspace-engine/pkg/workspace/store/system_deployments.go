package store

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewSystemDeployments(store *Store) *SystemDeployments {
	return &SystemDeployments{
		repo:  store.repo.SystemDeployments(),
		store: store,
	}
}

type SystemDeployments struct {
	repo  repository.SystemDeploymentRepo
	store *Store
}

// SetRepo replaces the underlying SystemDeploymentRepo implementation.
func (sd *SystemDeployments) SetRepo(repo repository.SystemDeploymentRepo) {
	sd.repo = repo
}

func (sd *SystemDeployments) GetSystemIDsForDeployment(deploymentID string) []string {
	return sd.repo.GetSystemIDsForDeployment(deploymentID)
}

func (sd *SystemDeployments) GetDeploymentIDsForSystem(systemID string) []string {
	return sd.repo.GetDeploymentIDsForSystem(systemID)
}

func (sd *SystemDeployments) Link(systemID, deploymentID string) error {
	if err := sd.repo.Link(systemID, deploymentID); err != nil {
		return err
	}
	sd.store.changeset.RecordUpsert(&oapi.SystemDeploymentLink{
		SystemId:     systemID,
		DeploymentId: deploymentID,
	})
	return nil
}

func (sd *SystemDeployments) Unlink(systemID, deploymentID string) error {
	if err := sd.repo.Unlink(systemID, deploymentID); err != nil {
		return err
	}
	sd.store.changeset.RecordDelete(&oapi.SystemDeploymentLink{
		SystemId:     systemID,
		DeploymentId: deploymentID,
	})
	return nil
}
