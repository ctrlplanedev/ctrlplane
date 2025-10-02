package store

import (
	"context"
	"workspace-engine/pkg/pb"
)

type Systems struct {
	store *Store
}

func (s *Systems) Upsert(ctx context.Context, system *pb.System) (*pb.System, error) {
	s.store.repo.Systems.Set(system.Id, system)
	return system, nil
}

func (s *Systems) Get(id string) (*pb.System, bool) {
	return s.store.repo.Systems.Get(id)
}

func (s *Systems) Has(id string) bool {
	return s.store.repo.Systems.Has(id)
}
