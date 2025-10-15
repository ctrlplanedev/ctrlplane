package jobs

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleJobUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	job := &oapi.Job{}
	if err := json.Unmarshal(event.Data, job); err != nil {
		return err
	}

	ws.Jobs().Upsert(ctx, job)

	return nil
}
