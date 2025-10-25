package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewReleases(store *Store) *Releases {
	return &Releases{
		repo: store.repo,
		store: store,
	}
}

type Releases struct {
	repo *repository.Repository
	store *Store
}

func (r *Releases) Upsert(ctx context.Context, release *oapi.Release) error {
	r.repo.Releases.Set(release.ID(), release)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, release)
	}
	return nil
}

func (r *Releases) Has(id string) bool {
	return r.repo.Releases.Has(id)
}

func (r *Releases) Get(id string) (*oapi.Release, bool) {
	return r.repo.Releases.Get(id)
}

func (r *Releases) Items() map[string]*oapi.Release {
	return r.repo.Releases.Items()
}

func (r *Releases) Remove(ctx context.Context, id string) {
	release, ok := r.repo.Releases.Get(id)
	if !ok || release == nil {
		return
	}

	r.repo.Releases.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, release)
	}
}

func (r *Releases) Jobs(releaseId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job, r.repo.Jobs.Count())
	for jobItem := range r.repo.Jobs.IterBuffered() {
		if jobItem.Val.ReleaseId != releaseId {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}
