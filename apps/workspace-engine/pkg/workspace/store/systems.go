package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewSystems(store *Store) *Systems {
	return &Systems{
		repo:         store.repo,
		store:        store,
	}
}

type Systems struct {
	repo  *repository.InMemoryStore
	store *Store
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
	return s.repo.Systems
}
