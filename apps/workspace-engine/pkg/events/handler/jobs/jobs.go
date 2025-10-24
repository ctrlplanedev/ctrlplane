package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/kafka/producer"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("events/handler/jobs")

func isStringUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func dispatchAndNotifyJob(ctx context.Context, ws *workspace.Workspace, job *oapi.Job) {
	if err := ws.ReleaseManager().JobDispatcher().DispatchJob(ctx, job); err != nil && !errors.Is(err, jobs.ErrUnsupportedJobAgent) {
		log.Error("error dispatching job to integration", "error", err.Error())
		job.Status = oapi.InvalidIntegration
		job.UpdatedAt = time.Now()
	}

	kafkaProducer, err := producer.NewProducer()
	if err != nil {
		log.Error("error creating kafka producer", "error", err.Error())
		return
	}
	defer kafkaProducer.Close()

	jobUpdateEvent := &oapi.JobUpdateEvent{
		AgentId:    &job.JobAgentId,
		ExternalId: job.ExternalId,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdate("status"),
		},
		Id:  &job.Id,
		Job: *job,
	}

	err = kafkaProducer.ProduceEvent("job.updated", ws.ID, jobUpdateEvent)
	if err != nil {
		log.Error("error producing job updated event", "error", err.Error())
		return
	}
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

func HandleJobCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleJobCreated")
	defer span.End()

	var job *oapi.Job
	if err := json.Unmarshal(event.Data, &job); err != nil {
		return err
	}

	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", job.Id),
		attribute.String("job.status", string(job.Status)),
		attribute.String("workspace.id", ws.ID),
	)

	ws.Jobs().Upsert(ctx, job)

	if ws.Store().IsReplay() {
		span.SetAttributes(attribute.Bool("job.replay", true))
		span.AddEvent("Skipping job creation in replay mode", trace.WithAttributes(
			attribute.String("job.id", job.Id),
			attribute.String("job.status", string(job.Status)),
			attribute.String("workspace.id", ws.ID),
		))
		return nil
	}

	if job.Status != oapi.InvalidJobAgent {
		go dispatchAndNotifyJob(ctx, ws, job)
	}

	return nil
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
