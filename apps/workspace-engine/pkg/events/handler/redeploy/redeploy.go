package redeploy

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
)

func HandleReleaseTargetDeploy(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	var releaseTargetID string
	if err := json.Unmarshal(event.Data, &releaseTargetID); err != nil {
		return err
	}

	releaseTarget := ws.ReleaseTargets().Get(releaseTargetID)
	if releaseTarget == nil {
		return fmt.Errorf("release target %q not found", releaseTargetID)
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
