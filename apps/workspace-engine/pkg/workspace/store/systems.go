package store

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

type Systems struct {
	repo *repository.Repository
}

func (s *Systems) Upsert(ctx context.Context, system *pb.System) (*pb.System, error) {
	s.repo.Systems.Set(system.Id, system)
	return system, nil
}

func (s *Systems) Get(id string) (*pb.System, bool) {
	return s.repo.Systems.Get(id)
}

func (s *Systems) Has(id string) bool {
	return s.repo.Systems.Has(id)
}
