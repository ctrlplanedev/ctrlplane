package versionmanager

import (
	"context"
	"fmt"
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
			Summary:       fmt.Sprintf("Version %s not found", version.Id),
			PolicyResults: nil,
			EvaluatedAt:   time.Now(),
		}
	}

	// Evaluate policies for this version and release target
	decision, err := m.policyManager.Evaluate(ctx, v, releaseTarget)
	if err != nil {
		return &policymanager.DeployDecision{
			Summary:       fmt.Sprintf("Error evaluating deployment policy: %v", err),
			PolicyResults: nil,
			EvaluatedAt:   time.Now(),
		}
	}

	// Summarize if the version can or cannot be deployed
	if decision.CanDeploy() {
		decision.Summary = fmt.Sprintf("Version `%s` can be deployed to target %s", v.Tag, releaseTarget.Id)
	} else {
		decision.Summary = fmt.Sprintf("Version `%s` cannot be deployed to target %s", v.Tag, releaseTarget.Id)
	}

	return decision
}

func (m *Manager) SelectDeployableVersion(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.DeploymentVersion, error) {
	versions := m.store.DeploymentVersions.Items()

	for _, version := range versions {
		if version.DeploymentId != releaseTarget.DeploymentId {
			continue
		}
		decision := m.GetDecisions(ctx, releaseTarget, version)
		if decision.CanDeploy() {
			return version, nil
		}
	}

	return nil, fmt.Errorf("no deployable version found")
}
