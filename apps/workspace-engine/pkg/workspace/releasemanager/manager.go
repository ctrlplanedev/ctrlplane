package releasemanager

import (
	"context"
	"sync"
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
	currentTargets      map[string]*pb.ReleaseTarget
	currentTargetsMutex sync.Mutex

	releaseTargetLocks sync.Map
	tainted            []*pb.ReleaseTarget
	tainedMutex        sync.Mutex
}

// New creates a new release manager for a workspace
func New(store *store.Store) *Manager {
	return &Manager{
		store:               store,
		currentTargets:      make(map[string]*pb.ReleaseTarget, 5000),
		policyManager:       policymanager.New(store),
		versionManager:      versionmanager.New(store),
		variableManager:     variablemanager.New(store),
		releaseTargetLocks:  sync.Map{},
		tainted:             make([]*pb.ReleaseTarget, 0, 100),
		tainedMutex:         sync.Mutex{},
		currentTargetsMutex: sync.Mutex{},
	}
}

type Changes struct {
	Added   []*pb.ReleaseTarget
	Removed []*pb.ReleaseTarget
	Tainted []*pb.ReleaseTarget
}

// SyncResult contains the results of a sync operation
type SyncResult struct {
	Changes Changes
}

func (m *Manager) ReleaseTargets() map[string]*pb.ReleaseTarget {
	return m.currentTargets
}

func (m *Manager) TaintReleaseTargets(releaseTarget *pb.ReleaseTarget) {
	m.tainedMutex.Lock()
	defer m.tainedMutex.Unlock()

	m.tainted = append(m.tainted, releaseTarget)
}

func (m *Manager) TaintDeploymentsReleaseTargets(deploymentId string) {
	m.tainedMutex.Lock()
	m.currentTargetsMutex.Lock()
	defer m.tainedMutex.Unlock()
	defer m.currentTargetsMutex.Unlock()

	for _, releaseTarget := range m.currentTargets {
		if releaseTarget.DeploymentId == deploymentId {
			m.tainted = append(m.tainted, releaseTarget)
		}
	}
}

func (m *Manager) TaintResourcesReleaseTargets(resourceId string) {
	m.tainedMutex.Lock()
	m.currentTargetsMutex.Lock()
	defer m.tainedMutex.Unlock()
	defer m.currentTargetsMutex.Unlock()

	for _, releaseTarget := range m.currentTargets {
		if releaseTarget.ResourceId == resourceId {
			m.tainted = append(m.tainted, releaseTarget)
		}
	}
}

func (m *Manager) TaintEnvironmentsReleaseTargets(environmentId string) {
	m.tainedMutex.Lock()
	m.currentTargetsMutex.Lock()
	defer m.tainedMutex.Unlock()
	defer m.currentTargetsMutex.Unlock()

	for _, releaseTarget := range m.currentTargets {
		if releaseTarget.EnvironmentId == environmentId {
			m.tainted = append(m.tainted, releaseTarget)
		}
	}
}

func (m *Manager) TaintAllReleaseTargets() {
	m.tainedMutex.Lock()
	m.currentTargetsMutex.Lock()
	defer m.tainedMutex.Unlock()
	defer m.currentTargetsMutex.Unlock()

	for _, releaseTarget := range m.currentTargets {
		m.tainted = append(m.tainted, releaseTarget)
	}
}

// Sync computes current release targets and determines what changed
// Returns what should be deployed based on changes
func (m *Manager) Reconcile(ctx context.Context) *SyncResult {
	m.currentTargetsMutex.Lock()
	defer m.currentTargetsMutex.Unlock()

	ctx, span := tracer.Start(ctx, "Sync",
		trace.WithAttributes(
			attribute.Int("current_targets.count", len(m.currentTargets)),
		))
	defer span.End()

	targets := m.store.ReleaseTargets.Items(ctx)

	span.SetAttributes(
		attribute.Int("new_targets.count", len(targets)),
	)

	m.tainedMutex.Lock()
	taintedCopy := make([]*pb.ReleaseTarget, len(m.tainted))
	copy(taintedCopy, m.tainted)
	m.tainted = m.tainted[:0] // More efficient than allocating new slice
	m.tainedMutex.Unlock()

	result := &SyncResult{
		Changes: Changes{
			Added:   make([]*pb.ReleaseTarget, 0, 100),
			Removed: make([]*pb.ReleaseTarget, 0, 100),
			Tainted: taintedCopy,
		},
	}

	// Detect added targets
	for key, target := range targets {
		_, existed := m.currentTargets[key]

		if !existed {
			result.Changes.Added = append(result.Changes.Added, target)
			continue
		}
	}

	// Detect deleted (removed) targets
	for key, oldTarget := range m.currentTargets {
		if _, exists := targets[key]; !exists {
			result.Changes.Removed = append(result.Changes.Removed, oldTarget)
		}
	}

	m.currentTargets = targets

	span.SetAttributes(
		attribute.Int("changes.added", len(result.Changes.Added)),
		attribute.Int("changes.removed", len(result.Changes.Removed)),
	)

	return result
}
