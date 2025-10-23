package redeploy

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandleReleaseTargetDeploy(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	releaseTarget := &oapi.ReleaseTarget{}
	if err := json.Unmarshal(event.Data, releaseTarget); err != nil {
		return err
	}

	ws.ReleaseManager().Redeploy(ctx, releaseTarget)

	return nil
}