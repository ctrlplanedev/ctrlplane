package workspace

import (
	"context"
	"workspace-engine/pkg/oapi"

	"github.com/aws/smithy-go/ptr"
)

type WorkspaceOption func(*Workspace)

func AddDefaultSystem() WorkspaceOption {
	return func(ws *Workspace) {
		ws.Systems().Upsert(context.Background(), &oapi.System{
			Id:          "00000000-0000-0000-0000-000000000000",
			Name:        "Default",
			Description: ptr.String("Default system"),
		})
	}
}
