package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewSystems(store *Store) *Systems {
	return &Systems{
		repo:  store.repo,
		store: store,
	}
}

type Systems struct {
	repo  *repository.Repo
	store *Store
}

func (s *Systems) Get(id string) (*oapi.System, bool) {
	return s.repo.Systems.Get(id)
}

func (s *Systems) Upsert(ctx context.Context, system *oapi.System) error {
	s.repo.Systems.Set(system.Id, system)
	s.store.changeset.RecordUpsert(system)

	return nil
}

func (s *Systems) Remove(ctx context.Context, id string) {
	system, ok := s.repo.Systems.Get(id)
	if !ok || system == nil {
		return
	}

	s.repo.Systems.Remove(id)
	s.store.changeset.RecordDelete(system)
}

func (s *Systems) Items() map[string]*oapi.System {
	return s.repo.Systems.Items()
}

func (s *Systems) Deployments(systemId string) map[string]*oapi.Deployment {
	deployments := make(map[string]*oapi.Deployment)
	for _, deployment := range s.repo.Deployments.Items() {
		if deployment.SystemId == systemId {
			deployments[deployment.Id] = deployment
		}
	}
	return deployments
}

func (s *Systems) Environments(systemId string) map[string]*oapi.Environment {
	environments := make(map[string]*oapi.Environment)
	for _, environment := range s.repo.Environments.Items() {
		if environment.SystemId == systemId {
			environments[environment.Id] = environment
		}
	}
	return environments
}
