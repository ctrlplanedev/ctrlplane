package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewReleases(store *Store) *Releases {
	return &Releases{
		repo:  store.repo,
		store: store,
	}
}

type Releases struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (r *Releases) Upsert(ctx context.Context, release *oapi.Release) error {
	r.repo.Releases.Set(release.ID(), release)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, release)
	}

	r.store.changeset.RecordUpsert(release)
	return nil
}

func (r *Releases) Get(id string) (*oapi.Release, bool) {
	return r.repo.Releases.Get(id)
}

func (r *Releases) Items() map[string]*oapi.Release {
	return r.repo.Releases
}

func (r *Releases) Remove(ctx context.Context, id string) {
	release, ok := r.repo.Releases.Get(id)
	if !ok || release == nil {
		return
	}

	r.repo.Releases.Remove(id)
	r.store.changeset.RecordDelete(release)
}

func (r *Releases) Jobs(releaseId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	for _, job := range r.repo.Jobs {
		if job.ReleaseId != releaseId {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}
