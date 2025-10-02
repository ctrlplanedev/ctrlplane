package releasemanager

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
)

// Manager handles the business logic for release target changes and deployment decisions
type Manager struct {
	store *store.Store
	versionManager *versionmanager.Manager
	
	// Current state of release targets (what currently exists)
	currentTargets map[string]*pb.ReleaseTarget
}

// New creates a new release manager for a workspace
func New(store *store.Store) *Manager {
	return &Manager{
		store:          store,
		currentTargets: make(map[string]*pb.ReleaseTarget, 1000),
		versionManager: versionmanager.New(store),
	}
}

// ChangeType represents the type of change to a release target
type ChangeType string

const (
	ChangeTypeAdded   ChangeType = "added"
	ChangeTypeRemoved ChangeType = "removed"
	ChangeTypeUpdated ChangeType = "updated"
)

// ReleaseTargetChange represents a detected change to a release target
type ReleaseTargetChange struct {
	NewTarget *pb.ReleaseTarget
	OldTarget *pb.ReleaseTarget
}

type Changes struct {
	Added   []*ReleaseTargetChange
	Updated []*ReleaseTargetChange
	Removed []*ReleaseTargetChange
}

// SyncResult contains the results of a sync operation
type SyncResult struct {
	Changes Changes
}

func (s *Manager) ReleaseTargets() map[string]*pb.ReleaseTarget {
	return s.currentTargets
}

// Sync computes current release targets and determines what changed
// Returns what should be deployed based on changes
func (m *Manager) Sync(ctx context.Context) *SyncResult {
	targets := m.store.ReleaseTargets.Items(ctx)

	result := &SyncResult{
		Changes: Changes{
			Added:   make([]*ReleaseTargetChange, 100),
			Updated: make([]*ReleaseTargetChange, 100),
			Removed: make([]*ReleaseTargetChange, 100),
		},
	}

	// Detect added and updated targets
	for key, target := range targets {
		oldTarget, existed := m.currentTargets[key]

		if !existed {
			// New target added
			change := &ReleaseTargetChange{NewTarget: target, OldTarget: nil}
			result.Changes.Added = append(result.Changes.Added, change)
			continue
		}

		// Target was updated - check if meaningful changes occurred
		if HasReleaseTargetChanged(ctx, m.store, oldTarget, target) {
			change := &ReleaseTargetChange{
				NewTarget: target,
				OldTarget: oldTarget,
			}
			result.Changes.Updated = append(result.Changes.Updated, change)
		}
	}

	// Detect deleted (removed) targets
	for key, oldTarget := range m.currentTargets {
		if _, exists := targets[key]; !exists {
			change := &ReleaseTargetChange{NewTarget: nil, OldTarget: oldTarget}
			result.Changes.Removed = append(result.Changes.Removed, change)
		}
	}

	m.currentTargets = targets

	log.Info("Release target sync completed",
		"added", len(result.Changes.Added),
		"updated", len(result.Changes.Updated),
		"removed", len(result.Changes.Removed),
	)

	return result
}

// OnResourceChange should be called when a resource changes
// This triggers a sync to detect new/removed release targets
func (m *Manager) OnResourceChange(ctx context.Context, resourceID string) *SyncResult {
	log.Debug("Resource changed, syncing release targets", "resource_id", resourceID)
	return m.Sync(ctx)
}

// OnEnvironmentChange should be called when an environment changes
func (m *Manager) OnEnvironmentChange(ctx context.Context, environmentID string) *SyncResult {
	log.Debug("Environment changed, syncing release targets", "environment_id", environmentID)
	return m.Sync(ctx)
}

// OnDeploymentChange should be called when a deployment changes
func (m *Manager) OnDeploymentChange(ctx context.Context, deploymentID string) *SyncResult {
	log.Debug("Deployment changed, syncing release targets", "deployment_id", deploymentID)
	return m.Sync(ctx)
}

func HasReleaseTargetChanged(ctx context.Context, store *store.Store, old, new *pb.ReleaseTarget) bool {
	return true
}
