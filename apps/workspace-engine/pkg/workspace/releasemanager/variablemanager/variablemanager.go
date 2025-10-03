package variablemanager

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"
)

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{store: store}
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (map[string]any, error) {
	return map[string]any{}, nil
}
