package targets

import (
	"context"
	"sync"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/releasemanager/targets")

func New(store *store.Store) *Manager {
	return &Manager{
		store:          store,
		currentTargets: make(map[string]*oapi.ReleaseTarget),
	}
}

type Manager struct {
	store *store.Store

	currentTargets      map[string]*oapi.ReleaseTarget
	currentTargetsMutex sync.Mutex
}

func (m *Manager) GetTargets(ctx context.Context) (map[string]*oapi.ReleaseTarget, error) {
	return m.store.ReleaseTargets.Items(ctx)
}

func (m *Manager) DetectChanges(ctx context.Context, changeSet *changeset.ChangeSet[any]) (*changeset.ChangeSet[*oapi.ReleaseTarget], error) {
	ctx, span := tracer.Start(ctx, "TargetsManager.DetectChanges")
	defer span.End()

	targets, err := m.store.ReleaseTargets.Items(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get targets")
		return nil, err
	}

	m.currentTargetsMutex.Lock()
	defer m.currentTargetsMutex.Unlock()

	changes := changeset.NewChangeSetWithDedup(func(target *oapi.ReleaseTarget) string {
		return target.Key()
	})
	defer changes.Finalize()

	taintedTargets := NewTaintProcessor(ctx, m.store, changeSet, targets).Tainted()

	var numTainted int
	var numCreated int
	var numDeleted int

	// Record all tainted targets to the changeset
	for _, target := range taintedTargets {
		changes.Record(changeset.ChangeTypeTaint, target)
		numTainted++
	}

	// Detect created targets
	for id, target := range targets {
		if _, existed := m.currentTargets[id]; !existed {
			changes.Record(changeset.ChangeTypeCreate, target)
			numCreated++
		}
	}

	// Detect deleted targets
	for id, oldTarget := range m.currentTargets {
		if _, exists := targets[id]; !exists {
			changes.Record(changeset.ChangeTypeDelete, oldTarget)
			numDeleted++
		}
	}

	span.SetAttributes(attribute.Int("release-target.tainted", numTainted))
	span.SetAttributes(attribute.Int("release-target.created", numCreated))
	span.SetAttributes(attribute.Int("release-target.deleted", numDeleted))

	return changes, nil
}

// RefreshTargets updates the manager's internal cache with the current state from the store
func (m *Manager) RefreshTargets(ctx context.Context) error {
	m.currentTargetsMutex.Lock()
	defer m.currentTargetsMutex.Unlock()

	rt, err := m.store.ReleaseTargets.Items(ctx)
	if err != nil {
		return err
	}

	m.currentTargets = rt

	return nil
}
