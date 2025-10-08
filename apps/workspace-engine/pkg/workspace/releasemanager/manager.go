package releasemanager

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager"
	"workspace-engine/pkg/workspace/releasemanager/variablemanager"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Manager handles the business logic for release target changes and deployment decisions
type Manager struct {
	store *store.Store

	versionManager  *versionmanager.Manager
	variableManager *variablemanager.Manager
	policyManager   *policymanager.Manager

	// Current state of release targets (what currently exists)
	currentTargets map[string]*pb.ReleaseTarget
}

// New creates a new release manager for a workspace
func New(store *store.Store) *Manager {
	return &Manager{
		store:           store,
		currentTargets:  make(map[string]*pb.ReleaseTarget, 5000),
		policyManager:   policymanager.New(store),
		versionManager:  versionmanager.New(store),
		variableManager: variablemanager.New(store),
	}
}

// ChangeType represents the type of change to a release target
type ChangeType string

const (
	ChangeTypeAdded   ChangeType = "added"
	ChangeTypeRemoved ChangeType = "removed"
)

// ReleaseTargetChange represents a detected change to a release target
type ReleaseTargetChange struct {
	NewTarget *pb.ReleaseTarget
	OldTarget *pb.ReleaseTarget
}

type Changes struct {
	Added   []*ReleaseTargetChange
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
func (m *Manager) Reconcile(ctx context.Context) *SyncResult {
	ctx, span := tracer.Start(ctx, "Sync",
		trace.WithAttributes(
			attribute.Int("current_targets.count", len(m.currentTargets)),
		))
	defer span.End()

	targets := m.store.ReleaseTargets.Items(ctx)

	span.SetAttributes(
		attribute.Int("new_targets.count", len(targets)),
	)

	result := &SyncResult{
		Changes: Changes{
			Added:   make([]*ReleaseTargetChange, 0, 100),
			Removed: make([]*ReleaseTargetChange, 0, 100),
		},
	}

	// Detect added targets
	for key, target := range targets {
		_, existed := m.currentTargets[key]

		if !existed {
			// New target added
			change := &ReleaseTargetChange{NewTarget: target, OldTarget: nil}
			result.Changes.Added = append(result.Changes.Added, change)
			continue
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

	span.SetAttributes(
		attribute.Int("changes.added", len(result.Changes.Added)),
		attribute.Int("changes.removed", len(result.Changes.Removed)),
	)

	return result
}
