package store

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewSystemEnvironments(store *Store) *SystemEnvironments {
	return &SystemEnvironments{
		repo:  store.repo.SystemEnvironments(),
		store: store,
	}
}

type SystemEnvironments struct {
	repo  repository.SystemEnvironmentRepo
	store *Store
}

// SetRepo replaces the underlying SystemEnvironmentRepo implementation.
func (se *SystemEnvironments) SetRepo(repo repository.SystemEnvironmentRepo) {
	se.repo = repo
}

func (se *SystemEnvironments) GetSystemIDsForEnvironment(environmentID string) []string {
	return se.repo.GetSystemIDsForEnvironment(environmentID)
}

func (se *SystemEnvironments) GetEnvironmentIDsForSystem(systemID string) []string {
	return se.repo.GetEnvironmentIDsForSystem(systemID)
}

func (se *SystemEnvironments) Link(systemID, environmentID string) error {
	if err := se.repo.Link(systemID, environmentID); err != nil {
		return err
	}
	se.store.changeset.RecordUpsert(&oapi.SystemEnvironmentLink{
		SystemId:      systemID,
		EnvironmentId: environmentID,
	})
	return nil
}

func (se *SystemEnvironments) Unlink(systemID, environmentID string) error {
	if err := se.repo.Unlink(systemID, environmentID); err != nil {
		return err
	}
	se.store.changeset.RecordDelete(&oapi.SystemEnvironmentLink{
		SystemId:      systemID,
		EnvironmentId: environmentID,
	})
	return nil
}
