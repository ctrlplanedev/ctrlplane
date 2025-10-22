package versions

import (
	"context"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("workspace/releasemanager/versionmanager")

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{
		store: store,
	}
}

// GetCandidateVersions returns all versions for a deployment, sorted newest to oldest.
// The caller is responsible for filtering based on policies or other criteria.
func (m *Manager) GetCandidateVersions(ctx context.Context, releaseTarget *oapi.ReleaseTarget) []*oapi.DeploymentVersion {
	_, span := tracer.Start(ctx, "GetCandidateVersions")
	defer span.End()

	versions := m.store.DeploymentVersions.Items()
	span.SetAttributes(
		attribute.Int("versions.count", len(versions)),
	)

	// Filter versions for the given deployment
	filtered := make([]*oapi.DeploymentVersion, 0, len(versions))
	for _, version := range versions {
		if version.DeploymentId == releaseTarget.DeploymentId {
			filtered = append(filtered, version)
		}
	}

	// Sort by CreatedAt (descending: newest first), then by Id (descending) if CreatedAt is the same
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].CreatedAt == filtered[j].CreatedAt {
			return filtered[i].Id > filtered[j].Id
		}
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	return filtered
}
