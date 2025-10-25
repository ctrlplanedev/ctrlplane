package workspace

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/aws/smithy-go/ptr"
)

type WorkspaceOption func(*Workspace)

func WithDatabseChangesetConsumer() WorkspaceOption {
	return func(ws *Workspace) {
		cc := db.NewChangesetConsumer(ws.ID, ws.store)
		ws.changesetConsumer = cc
	}
}

func WithDefaultSystem() WorkspaceOption {
	return func(ws *Workspace) {
		ws.Systems().Upsert(context.Background(), &oapi.System{
			Id:          "00000000-0000-0000-0000-000000000000",
			Name:        "Default",
			Description: ptr.String("Default system"),
		})
	}
}
