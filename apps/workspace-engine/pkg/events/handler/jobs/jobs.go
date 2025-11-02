package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

func isStringUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func getInternalReleaseID(ws *workspace.Workspace, jobUpdateEvent *oapi.JobUpdateEvent) string {
	eventReleaseID := jobUpdateEvent.Job.ReleaseId
	if eventReleaseID == "" {
		return ""
	}

	if !isStringUUID(eventReleaseID) {
		return eventReleaseID
	}

	for _, release := range ws.Releases().Items() {
		if release.UUID().String() == eventReleaseID {
			return release.ID()
		}
	}

	return ""
}

func HandleJobUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var jobUpdateEvent *oapi.JobUpdateEvent
	if err := json.Unmarshal(event.Data, &jobUpdateEvent); err != nil {
		return err
	}

	internalReleaseID := getInternalReleaseID(ws, jobUpdateEvent)
	jobUpdateEvent.Job.ReleaseId = internalReleaseID

	job, exists := getJob(ws, jobUpdateEvent)
	if !exists {
		return fmt.Errorf("job not found")
	}

	// No fields specified - replace entire job
	if jobUpdateEvent.FieldsToUpdate == nil || len(*jobUpdateEvent.FieldsToUpdate) == 0 {
		ws.Jobs().Upsert(ctx, &jobUpdateEvent.Job)
		return nil
	}

	file := make([]string, len(*jobUpdateEvent.FieldsToUpdate))
	for i, field := range *jobUpdateEvent.FieldsToUpdate {
		file[i] = string(field)
	}
	mergedJob, err := handler.MergeFields(job, &jobUpdateEvent.Job, file)
	if err != nil {
		return err
	}

	ws.Jobs().Upsert(ctx, mergedJob)

	go func() {
		if err := MaybeAddCommitStatusFromJob(ws, mergedJob); err != nil {
			log.Error("error adding commit status", "error", err.Error())
		}
	}()

	return nil
}

func getJob(ws *workspace.Workspace, job *oapi.JobUpdateEvent) (*oapi.Job, bool) {
	if job.Id != nil && *job.Id != "" {
		if existing, exists := ws.Jobs().Get(*job.Id); exists {
			return existing, true
		}
	}

	if job.AgentId == nil || *job.AgentId == "" {
		return nil, false
	}

	if job.ExternalId == nil || *job.ExternalId == "" {
		return nil, false
	}

	// Try finding by job agent ID + external ID
	return ws.Jobs().GetByJobAgentAndExternalId(*job.AgentId, *job.ExternalId)
}
