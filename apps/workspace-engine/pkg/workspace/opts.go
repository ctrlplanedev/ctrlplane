package workspace

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"

	"github.com/aws/smithy-go/ptr"
)

type WorkspaceOption func(*Workspace)

func WithTraceStore(s releasemanager.PersistenceStore) WorkspaceOption {
	return func(ws *Workspace) {
		ws.traceStore = s
	}
}

// WithStoreOptions applies the given store options to the workspace's store.
func WithStoreOptions(opts ...store.StoreOption) WorkspaceOption {
	return func(ws *Workspace) {
		for _, opt := range opts {
			opt(ws.store)
		}
	}
}

func AddDefaultSystem() WorkspaceOption {
	return func(ws *Workspace) {
		_ = ws.Systems().Upsert(context.Background(), &oapi.System{
			Id:          "00000000-0000-0000-0000-000000000000",
			Name:        "Default",
			Description: ptr.String("Default system"),
		})
	}
}
