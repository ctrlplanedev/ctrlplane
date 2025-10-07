package versionmanager

import (
	"context"
	"fmt"
	"sort"
	"time"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager"
	"workspace-engine/pkg/workspace/store"
)

type Manager struct {
	store *store.Store

	policyManager *policymanager.Manager
}

func New(store *store.Store) *Manager {
	return &Manager{
		store:         store,
		policyManager: policymanager.New(store),
	}
}

// GetDecisions determines if a given version can be deployed to a release target.
// It returns a DeployDecision summarizing the result.
func (m *Manager) GetDecisions(ctx context.Context, releaseTarget *pb.ReleaseTarget, version *pb.DeploymentVersion) *policymanager.DeployDecision {
	// Fetch the latest version object from the store
	v, exists := m.store.DeploymentVersions.Get(version.Id)
	if !exists {
		return &policymanager.DeployDecision{
			PolicyResults: nil,
			EvaluatedAt:   time.Now(),
		}
	}

	// Evaluate policies for this version and release target
	decision, err := m.policyManager.Evaluate(ctx, v, releaseTarget)
	if err != nil {
		return &policymanager.DeployDecision{
			PolicyResults: nil,
			EvaluatedAt:   time.Now(),
		}
	}

	return decision
}

func (m *Manager) LatestDeployableVersion(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.DeploymentVersion, error) {
	versions := m.store.DeploymentVersions.Items()

	// Filter versions for the given deployment
	filtered := make([]*pb.DeploymentVersion, 0, len(versions))
	for _, version := range versions {
		if version.DeploymentId == releaseTarget.DeploymentId {
			filtered = append(filtered, version)
		}
	}

	// Sort by CreatedAt (descending: newest first)
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})

	for _, version := range filtered {
		decision := m.GetDecisions(ctx, releaseTarget, version)
		if decision.CanDeploy() {
			return version, nil
		}
	}

	return nil, fmt.Errorf("no deployable version found")
}
