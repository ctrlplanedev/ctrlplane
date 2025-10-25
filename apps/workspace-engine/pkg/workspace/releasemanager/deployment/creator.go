package deployment

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// EventProducer defines the interface for producing events.
type EventProducer interface {
	ProduceEvent(eventType string, workspaceID string, data any) error
}

// JobCreator handles job creation for releases (Phase 2: ACTION - Event dispatch).
type JobCreator struct {
	store         *store.Store
	jobFactory    *jobs.Factory
	eventProducer EventProducer
}

// NewJobCreator creates a new job creator.
func NewJobCreator(store *store.Store, eventProducer EventProducer) *JobCreator {
	return &JobCreator{
		store:         store,
		jobFactory:    jobs.NewFactory(store),
		eventProducer: eventProducer,
	}
}

// JobCreatedEventData contains the data for a job.created event.
type JobCreatedEventData struct {
	Job *oapi.Job `json:"job"`
}

// CreateJobForRelease creates a job for a release and sends a job.created event.
// Precondition: Planner has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the planning phase.
// This method persists the release immediately and sends an event for job creation.
func (c *JobCreator) CreateJobForRelease(ctx context.Context, releaseToDeploy *oapi.Release) error {
	ctx, span := tracer.Start(ctx, "CreateJobForRelease")
	defer span.End()

	// Step 1: Persist the release immediately
	// The release is already validated and computed - it's a "done deal"
	if err := c.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to upsert release: %w", err)
	}

	// Step 2: Create the job (pure function, no writes)
	newJob, err := c.jobFactory.CreateJobForRelease(ctx, releaseToDeploy)
	if err != nil {
		span.RecordError(err)
		return err
	}

	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", newJob.Id),
		attribute.String("job.status", string(newJob.Status)),
	)

	// Step 3: Send job.created event with just the job
	// The event handler will handle job persistence, outdated job cancellation, and dispatch
	eventData := JobCreatedEventData{
		Job: newJob,
	}

	workspaceID := c.store.WorkspaceID()
	if c.eventProducer == nil {
		return fmt.Errorf("event producer is nil - cannot send job.created event")
	}
	
	if err := c.eventProducer.ProduceEvent("job.created", workspaceID, eventData); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to produce job.created event: %w", err)
	}

	return nil
}

// BuildRelease constructs a release object from its components.
func BuildRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
	variables map[string]*oapi.LiteralValue,
) *oapi.Release {
	_, span := tracer.Start(ctx, "BuildRelease",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
			attribute.String("version.id", version.Id),
			attribute.String("version.tag", version.Tag),
			attribute.String("variables.count", fmt.Sprintf("%d", len(variables))),
		))
	defer span.End()

	// Clone variables to avoid mutations affecting this release
	clonedVariables := make(map[string]oapi.LiteralValue, len(variables))
	for key, value := range variables {
		if value != nil {
			clonedVariables[key] = *value
		}
	}

	return &oapi.Release{
		ReleaseTarget:      *releaseTarget,
		Version:            *version,
		Variables:          clonedVariables,
		EncryptedVariables: []string{}, // TODO: Handle encrypted variables
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}

