package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewPolicyBypasses(store *Store) *PolicyBypasses {
	return &PolicyBypasses{
		repo:  store.repo,
		store: store,
	}
}

type PolicyBypasses struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (pb *PolicyBypasses) Items() map[string]*oapi.PolicyBypass {
	return pb.repo.PolicyBypasses.Items()
}

func (pb *PolicyBypasses) Get(id string) (*oapi.PolicyBypass, bool) {
	return pb.repo.PolicyBypasses.Get(id)
}

func (pb *PolicyBypasses) Upsert(ctx context.Context, bypass *oapi.PolicyBypass) {
	pb.repo.PolicyBypasses.Set(bypass.Id, bypass)
	pb.store.changeset.RecordUpsert(bypass)
}

func (pb *PolicyBypasses) Remove(ctx context.Context, id string) {
	bypass, ok := pb.repo.PolicyBypasses.Get(id)
	if !ok || bypass == nil {
		return
	}

	pb.repo.PolicyBypasses.Remove(id)
	pb.store.changeset.RecordDelete(bypass)
}

// GetForTarget finds the most specific bypass matching the given version, environment, and resource.
// Precedence (most to least specific):
// 1. Exact match: version + environment + resource
// 2. Environment wildcard: version + environment + nil
// 3. Full wildcard: version + nil + nil
//
// Returns the first non-expired matching bypass, or nil if none found.
func (pb *PolicyBypasses) GetForTarget(
	versionId string,
	environmentId string,
	resourceId string,
) *oapi.PolicyBypass {
	now := time.Now()

	// Try exact match: version + environment + resource
	for _, bypass := range pb.repo.PolicyBypasses.Items() {
		if bypass.VersionId != versionId {
			continue
		}

		// Check if expired
		if bypass.ExpiresAt != nil && bypass.ExpiresAt.Before(now) {
			continue
		}

		// Exact match
		if bypass.EnvironmentId != nil && *bypass.EnvironmentId == environmentId &&
			bypass.ResourceId != nil && *bypass.ResourceId == resourceId {
			return bypass
		}
	}

	// Try environment wildcard: version + environment (all resources)
	for _, bypass := range pb.repo.PolicyBypasses.Items() {
		if bypass.VersionId != versionId {
			continue
		}

		// Check if expired
		if bypass.ExpiresAt != nil && bypass.ExpiresAt.Before(now) {
			continue
		}

		// Environment match, resource wildcard
		if bypass.EnvironmentId != nil && *bypass.EnvironmentId == environmentId &&
			bypass.ResourceId == nil {
			return bypass
		}
	}

	// Try full wildcard: version only (all environments and resources)
	for _, bypass := range pb.repo.PolicyBypasses.Items() {
		if bypass.VersionId != versionId {
			continue
		}

		// Check if expired
		if bypass.ExpiresAt != nil && bypass.ExpiresAt.Before(now) {
			continue
		}

		// Full wildcard
		if bypass.EnvironmentId == nil && bypass.ResourceId == nil {
			return bypass
		}
	}

	return nil
}

// GetAllForTarget returns ALL non-expired bypasses that match the target, ordered by specificity.
// This is useful when multiple bypasses might apply and you want to OR their rule types together.
func (pb *PolicyBypasses) GetAllForTarget(
	versionId string,
	environmentId string,
	resourceId string,
) []*oapi.PolicyBypass {
	now := time.Now()
	var matches []*oapi.PolicyBypass

	// Collect all matching non-expired bypasses
	for _, bypass := range pb.repo.PolicyBypasses.Items() {
		if bypass.VersionId != versionId {
			continue
		}

		// Check if expired
		if bypass.ExpiresAt != nil && bypass.ExpiresAt.Before(now) {
			continue
		}

		// Check if this bypass matches the target
		matches = append(matches, bypass)
		if bypass.EnvironmentId != nil && *bypass.EnvironmentId == environmentId {
			if bypass.ResourceId == nil || *bypass.ResourceId == resourceId {
				matches = append(matches, bypass)
			}
		} else if bypass.EnvironmentId == nil {
			// Full wildcard matches
			matches = append(matches, bypass)
		}
	}

	return matches
}
