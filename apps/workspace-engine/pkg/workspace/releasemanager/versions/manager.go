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

// GetCandidateVersions returns deployment versions eligible for evaluation,
// sorted newest to oldest by CreatedAt (then by Id as a tiebreaker).
//
// earliestVersionForEvaluation is an optional lower bound that limits which
// versions are considered. When non-nil, only versions created at or after the
// given version are returned. This is used as a performance optimisation during
// event-driven reconciliation: when a specific event triggers re-evaluation
// (e.g. a new version is created, an approval is granted, or a policy skip is
// added), only that version and newer ones could possibly change the deployment
// decision, so older versions can be skipped entirely.
//
// When nil, all versions for the deployment are returned — this is the default
// for full reconciliation and API-driven state computation.
func (m *Manager) GetCandidateVersions(ctx context.Context, releaseTarget *oapi.ReleaseTarget, earliestVersionForEvaluation *oapi.DeploymentVersion) []*oapi.DeploymentVersion {
	_, span := tracer.Start(ctx, "GetCandidateVersions",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	allVersions := m.store.DeploymentVersions.Items()

	// Filter to only versions belonging to this deployment
	filtered := make([]*oapi.DeploymentVersion, 0, len(allVersions))
	for _, version := range allVersions {
		if version.DeploymentId == releaseTarget.DeploymentId {
			filtered = append(filtered, version)
		}
	}

	// Sort newest first; use Id as a stable tiebreaker when CreatedAt is equal
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].CreatedAt.Equal(filtered[j].CreatedAt) {
			return filtered[i].Id > filtered[j].Id
		}
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	span.SetAttributes(
		attribute.Int("versions.total_in_store", len(allVersions)),
		attribute.Int("versions.for_deployment", len(filtered)),
	)

	// If no lower bound is set, return all versions for this deployment.
	if earliestVersionForEvaluation == nil {
		return filtered
	}

	// Truncate the sorted list at the lower bound — since versions are sorted
	// newest-first, we keep everything until we hit a version older than the
	// bound.
	truncated := make([]*oapi.DeploymentVersion, 0, len(filtered))
	for _, version := range filtered {
		if version.CreatedAt.Before(earliestVersionForEvaluation.CreatedAt) {
			break
		}
		truncated = append(truncated, version)
	}

	span.SetAttributes(
		attribute.Int("versions.after_lower_bound", len(truncated)),
		attribute.String("versions.lower_bound_id", earliestVersionForEvaluation.Id),
	)

	return truncated
}
