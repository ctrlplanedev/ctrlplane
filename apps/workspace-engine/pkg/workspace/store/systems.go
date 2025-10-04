package store

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

type Systems struct {
	repo *repository.Repository

	deployments  cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.Deployment]]
	environments cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.Environment]]
}

func (s *Systems) Upsert(ctx context.Context, system *pb.System) error {
	s.repo.Systems.Set(system.Id, system)

	if _, ok := s.deployments.Get(system.Id); !ok {
		s.deployments.Set(system.Id,
			materialized.New(s.computeDeployments(system.Id)),
		)
		s.environments.Set(system.Id,
			materialized.New(s.computeEnvironments(system.Id)),
		)
	}

	return nil
}

func (s *Systems) Get(id string) (*pb.System, bool) {
	return s.repo.Systems.Get(id)
}

func (s *Systems) Has(id string) bool {
	return s.repo.Systems.Has(id)
}

func (s *Systems) computeDeployments(systemId string) materialized.RecomputeFunc[map[string]*pb.Deployment] {
	return func() (map[string]*pb.Deployment, error) {
		deployments := make(map[string]*pb.Deployment, s.repo.Deployments.Count())
		for deploymentItem := range s.repo.Deployments.IterBuffered() {
			if deploymentItem.Val.SystemId != systemId {
				continue
			}
			deployments[deploymentItem.Key] = deploymentItem.Val
		}
		return deployments, nil
	}
}

func (s *Systems) Deployments(systemId string) map[string]*pb.Deployment {
	mv, ok := s.deployments.Get(systemId)
	if !ok {
		return map[string]*pb.Deployment{}
	}
	mv.WaitRecompute()
	return mv.Get()
}

func (s *Systems) computeEnvironments(systemId string) materialized.RecomputeFunc[map[string]*pb.Environment] {
	return func() (map[string]*pb.Environment, error) {
		environments := make(map[string]*pb.Environment, s.repo.Environments.Count())
		for environmentItem := range s.repo.Environments.IterBuffered() {
			if environmentItem.Val.SystemId != systemId {
				continue
			}
			environments[environmentItem.Key] = environmentItem.Val
		}
		return environments, nil
	}
}

func (s *Systems) Environments(systemId string) map[string]*pb.Environment {
	mv, ok := s.environments.Get(systemId)
	if !ok {
		return map[string]*pb.Environment{}
	}
	mv.WaitRecompute()
	return mv.Get()
}

func (s *Systems) Remove(id string) {
	deployments := s.Deployments(id)
	for key := range deployments {
		s.repo.Deployments.Remove(key)
	}

	environments := s.Environments(id)
	for key := range environments {
		s.repo.Environments.Remove(key)
	}

	s.repo.Systems.Remove(id)
	s.deployments.Remove(id)
	s.environments.Remove(id)
}
