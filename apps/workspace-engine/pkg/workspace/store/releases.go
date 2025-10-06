package store

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewReleases(store *Store) *Releases {
	return &Releases{
		repo: store.repo,
	}
}

type Releases struct {
	repo *repository.Repository
}

func (r *Releases) Upsert(ctx context.Context, release *pb.Release) error {
	r.repo.Releases.Set(release.ID(), release)
	return nil
}

func (r *Releases) Has(id string) bool {
	return r.repo.Releases.Has(id)
}

func (r *Releases) Get(id string) (*pb.Release, bool) {
	return r.repo.Releases.Get(id)
}

func (r *Releases) Remove(id string) {
	r.repo.Releases.Remove(id)
}

func (r *Releases) Jobs(releaseId string) map[string]*pb.Job {
	jobs := make(map[string]*pb.Job, r.repo.Jobs.Count())
	for jobItem := range r.repo.Jobs.IterBuffered() {
		if jobItem.Val.ReleaseId != releaseId {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}
