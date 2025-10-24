package redeploy

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
)

func HandleReleaseTargetDeploy(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	releaseTarget := &oapi.ReleaseTarget{}
	if err := json.Unmarshal(event.Data, releaseTarget); err != nil {
		return err
	}

	if err := ws.ReleaseManager().Redeploy(ctx, releaseTarget); err != nil {
		log.Warn("Failed to redeploy release target",
			"releaseTargetKey", releaseTarget.Key(),
			"error", err.Error())
		// Don't return error - we've logged it but don't want to fail event processing
		// The user can retry the redeploy later when the job completes
		return nil
	}

	return nil
}
