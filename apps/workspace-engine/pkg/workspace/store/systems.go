package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewSystems(store *Store) *Systems {
	return &Systems{
		repo:  store.repo.Systems(),
		store: store,
	}
}

type Systems struct {
	repo  repository.SystemRepo
	store *Store
}

// SetRepo replaces the underlying SystemRepo implementation.
func (s *Systems) SetRepo(repo repository.SystemRepo) {
	s.repo = repo
}

func (s *Systems) Get(id string) (*oapi.System, bool) {
	return s.repo.Get(id)
}

func (s *Systems) Upsert(ctx context.Context, system *oapi.System) error {
	if err := s.repo.Set(system); err != nil {
		log.Error("Failed to upsert system", "error", err)
	}
	s.store.changeset.RecordUpsert(system)

	return nil
}

func (s *Systems) Remove(ctx context.Context, id string) {
	system, ok := s.repo.Get(id)
	if !ok || system == nil {
		return
	}

	s.repo.Remove(id)
	s.store.changeset.RecordDelete(system)
}

func (s *Systems) Items() map[string]*oapi.System {
	return s.repo.Items()
}

func (s *Systems) Deployments(systemId string) map[string]*oapi.Deployment {
	return s.store.Deployments.repo.GetBySystemID(systemId)
}

func (s *Systems) Environments(systemId string) map[string]*oapi.Environment {
	return s.store.Environments.repo.GetBySystemID(systemId)
}
