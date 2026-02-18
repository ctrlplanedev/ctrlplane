package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type GithubEntities struct {
	repo  *memory.InMemory
	store *Store
}

func NewGithubEntities(store *Store) *GithubEntities {
	return &GithubEntities{
		repo:  store.repo,
		store: store,
	}
}

func (g *GithubEntities) key(slug string, installationId int) string {
	return fmt.Sprintf("%s-%d", slug, installationId)
}

func (g *GithubEntities) Upsert(ctx context.Context, githubEntity *oapi.GithubEntity) {
	key := g.key(githubEntity.Slug, githubEntity.InstallationId)
	g.repo.GithubEntities.Set(key, githubEntity)
	g.store.changeset.RecordUpsert(githubEntity)
}

func (g *GithubEntities) Get(slug string, installationId int) (*oapi.GithubEntity, bool) {
	key := g.key(slug, installationId)
	return g.repo.GithubEntities.Get(key)
}

func (g *GithubEntities) Remove(ctx context.Context, slug string, installationId int) {
	key := g.key(slug, installationId)
	githubEntity, ok := g.repo.GithubEntities.Get(key)
	if !ok || githubEntity == nil {
		return
	}

	g.repo.GithubEntities.Remove(key)
	g.store.changeset.RecordDelete(githubEntity)
}

func (g *GithubEntities) Items() map[string]*oapi.GithubEntity {
	return g.repo.GithubEntities.Items()
}
