package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewPolicySkips(store *Store) *PolicySkips {
	return &PolicySkips{
		repo:  store.repo.PolicySkips(),
		store: store,
	}
}

type PolicySkips struct {
	repo  repository.PolicySkipRepo
	store *Store
}

func (pb *PolicySkips) SetRepo(repo repository.PolicySkipRepo) {
	pb.repo = repo
}

func (pb *PolicySkips) Items() map[string]*oapi.PolicySkip {
	return pb.repo.Items()
}

func (pb *PolicySkips) Get(id string) (*oapi.PolicySkip, bool) {
	return pb.repo.Get(id)
}

func (pb *PolicySkips) Upsert(ctx context.Context, skip *oapi.PolicySkip) {
	if err := pb.repo.Set(skip); err != nil {
		log.Error("Failed to upsert policy skip", "error", err)
		return
	}
	pb.store.changeset.RecordUpsert(skip)
}

func (pb *PolicySkips) Remove(ctx context.Context, id string) {
	skip, ok := pb.repo.Get(id)
	if !ok || skip == nil {
		return
	}

	if err := pb.repo.Remove(id); err != nil {
		log.Error("Failed to remove policy skip", "error", err)
		return
	}
	pb.store.changeset.RecordDelete(skip)
}

// GetForTarget finds the most specific skip matching the given version, environment, and resource.
// Precedence (most to least specific):
// 1. Exact match: version + environment + resource
// 2. Environment wildcard: version + environment + nil
// 3. Full wildcard: version + nil + nil
//
// Returns the first non-expired matching skip, or nil if none found.
func (pb *PolicySkips) GetForTarget(
	versionId string,
	environmentId string,
	resourceId string,
) *oapi.PolicySkip {
	now := time.Now()

	// Try exact match: version + environment + resource
	for _, skip := range pb.repo.Items() {
		if skip.VersionId != versionId {
			continue
		}

		if skip.ExpiresAt != nil && skip.ExpiresAt.Before(now) {
			continue
		}

		if skip.EnvironmentId != nil && *skip.EnvironmentId == environmentId &&
			skip.ResourceId != nil && *skip.ResourceId == resourceId {
			return skip
		}
	}

	// Try environment wildcard: version + environment (all resources)
	for _, skip := range pb.repo.Items() {
		if skip.VersionId != versionId {
			continue
		}

		if skip.ExpiresAt != nil && skip.ExpiresAt.Before(now) {
			continue
		}

		if skip.EnvironmentId != nil && *skip.EnvironmentId == environmentId &&
			skip.ResourceId == nil {
			return skip
		}
	}

	// Try full wildcard: version only (all environments and resources)
	for _, skip := range pb.repo.Items() {
		if skip.VersionId != versionId {
			continue
		}

		if skip.ExpiresAt != nil && skip.ExpiresAt.Before(now) {
			continue
		}

		if skip.EnvironmentId == nil && skip.ResourceId == nil {
			return skip
		}
	}

	return nil
}

// GetAllForTarget returns ALL non-expired skips that match the target, ordered by specificity.
// This is useful when multiple skips might apply and you want to OR their rule types together.
func (pb *PolicySkips) GetAllForTarget(
	versionId string,
	environmentId string,
	resourceId string,
) []*oapi.PolicySkip {
	now := time.Now()
	var matches []*oapi.PolicySkip

	for _, skip := range pb.repo.Items() {
		if skip.VersionId != versionId {
			continue
		}

		if skip.ExpiresAt != nil && skip.ExpiresAt.Before(now) {
			continue
		}

		if skip.EnvironmentId != nil && *skip.EnvironmentId == environmentId {
			if skip.ResourceId == nil || *skip.ResourceId == resourceId {
				matches = append(matches, skip)
			}
		} else if skip.EnvironmentId == nil {
			matches = append(matches, skip)
		}
	}

	return matches
}
