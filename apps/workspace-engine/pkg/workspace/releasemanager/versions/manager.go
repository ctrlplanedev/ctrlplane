package versions

import (
	"context"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
func (m *Manager) GetCandidateVersions(ctx context.Context, releaseTarget *oapi.ReleaseTarget, earliestVersionForEvaluation *oapi.DeploymentVersion) []*oapi.DeploymentVersion {
	_, span := tracer.Start(ctx, "GetCandidateVersions",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	span.AddEvent("Retrieving all versions from store")
	allVersions := m.store.DeploymentVersions.Items()

	span.SetAttributes(
		attribute.Int("versions.all_count", len(allVersions)),
	)

	span.AddEvent("Filtering versions for deployment")
	filtered := []*oapi.DeploymentVersion{}
	for _, version := range allVersions {
		if version.DeploymentId == releaseTarget.DeploymentId {
			filtered = append(filtered, version)
		}
	}

	span.SetAttributes(
		attribute.Int("versions.filtered_count", len(filtered)),
	)

	// Sort by CreatedAt (descending: newest first), then by Id (descending) if CreatedAt is the same
	span.AddEvent("Sorting versions by CreatedAt (newest first)")
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].CreatedAt.Equal(filtered[j].CreatedAt) {
			return filtered[i].Id > filtered[j].Id
		}
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	if len(filtered) > 0 {
		span.SetAttributes(
			attribute.String("versions.newest_id", filtered[0].Id),
			attribute.String("versions.newest_tag", filtered[0].Tag),
			attribute.String("versions.newest_created_at", filtered[0].CreatedAt.Format("2006-01-02T15:04:05Z")),
		)
	}

	if earliestVersionForEvaluation == nil {
		return filtered
	}

	laterThanEarliestVersion := []*oapi.DeploymentVersion{}
	for _, version := range filtered {
		if version.CreatedAt.Before(earliestVersionForEvaluation.CreatedAt) {
			break
		}

		laterThanEarliestVersion = append(laterThanEarliestVersion, version)
	}
	return laterThanEarliestVersion
}
