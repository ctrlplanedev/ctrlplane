package jobdispatch

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var trTracer = otel.Tracer("TestRunnerDispatcher")

// TestRunnerDispatcher is a test job dispatcher that automatically resolves jobs
// after a configurable delay. This is useful for testing and development scenarios
// where you want jobs to complete without actual external execution.
type TestRunnerDispatcher struct {
	store *store.Store
	// timeFunc allows overriding time.After for testing
	timeFunc func(d time.Duration) <-chan time.Time
	// producerFactory allows overriding the Kafka producer for testing
	producerFactory func() (messaging.Producer, error)
}

// NewTestRunnerDispatcher creates a new test-runner dispatcher.
func NewTestRunnerDispatcher(store *store.Store) *TestRunnerDispatcher {
	return &TestRunnerDispatcher{
		store:           store,
		timeFunc:        time.After,
		producerFactory: nil, // will use default Kafka producer
	}
}

// TestRunnerDispatcherOptions contains optional configuration for testing.
type TestRunnerDispatcherOptions struct {
	TimeFunc        func(d time.Duration) <-chan time.Time
	ProducerFactory func() (messaging.Producer, error)
}

// NewTestRunnerDispatcherWithOptions creates a dispatcher with custom options (useful for testing).
func NewTestRunnerDispatcherWithOptions(store *store.Store, opts TestRunnerDispatcherOptions) *TestRunnerDispatcher {
	d := &TestRunnerDispatcher{
		store:           store,
		timeFunc:        time.After,
		producerFactory: opts.ProducerFactory,
	}
	if opts.TimeFunc != nil {
		d.timeFunc = opts.TimeFunc
	}
	return d
}

func (d *TestRunnerDispatcher) getDelay(cfg *oapi.TestRunnerJobAgentConfig) time.Duration {
	if cfg.DelaySeconds != nil {
		return time.Duration(*cfg.DelaySeconds) * time.Second
	}
	return 5 * time.Second // default delay
}

func (d *TestRunnerDispatcher) getFinalStatus(cfg oapi.TestRunnerJobAgentConfig) oapi.JobStatus {
	if cfg.Status != nil && *cfg.Status == string(oapi.JobStatusFailure) {
		return oapi.JobStatusFailure
	}
	return oapi.JobStatusSuccessful
}

// DispatchJob starts the test-runner process for a job.
// It spawns a goroutine that waits for the configured delay and then updates the job status.
func (d *TestRunnerDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	ctx, span := trTracer.Start(ctx, "TestRunnerDispatcher.DispatchJob")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", job.Id))

	cfg, err := job.GetTestRunnerJobAgentConfig()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		return err
	}

	delay := d.getDelay(cfg)
	finalStatus := d.getFinalStatus(*cfg)
	message := ""
	if cfg.Message != nil {
		message = *cfg.Message
	}

	span.SetAttributes(
		attribute.Int64("delay_seconds", int64(delay.Seconds())),
		attribute.String("final_status", string(finalStatus)),
	)

	// Start a goroutine to resolve the job after the delay
	go d.resolveJobAfterDelay(context.WithoutCancel(ctx), job.Id, delay, finalStatus, message)

	span.SetStatus(codes.Ok, "test-runner scheduled")
	return nil
}

func (d *TestRunnerDispatcher) resolveJobAfterDelay(ctx context.Context, jobID string, delay time.Duration, status oapi.JobStatus, message string) {
	_, span := trTracer.Start(ctx, "TestRunnerDispatcher.resolveJobAfterDelay")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", jobID),
		attribute.Int64("delay_seconds", int64(delay.Seconds())),
	)

	// Wait for the configured delay
	<-d.timeFunc(delay)

	// Get the current job state
	job, exists := d.store.Jobs.Get(jobID)
	if !exists {
		span.RecordError(fmt.Errorf("job %s not found", jobID))
		span.SetStatus(codes.Error, "job not found")
		return
	}

	// Only update if job is still in a pending/running state
	// Don't override if it was already completed, failed, or cancelled externally
	if job.Status != oapi.JobStatusPending && job.Status != oapi.JobStatusInProgress {
		span.AddEvent("Job already in terminal state, skipping resolution",
			oteltrace.WithAttributes(attribute.String("current_status", string(job.Status))))
		return
	}

	// Build the message
	resolveMsg := fmt.Sprintf("Resolved by test-runner dispatcher after %v", delay)
	var finalMessage string
	if message != "" {
		finalMessage = message + "\n" + resolveMsg
	} else {
		finalMessage = resolveMsg
	}

	// Send job update event to Kafka queue
	if err := d.sendJobUpdateEvent(job, status, finalMessage); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to send job update event")
		return
	}

	span.SetStatus(codes.Ok, "job resolved by test-runner")
	span.SetAttributes(attribute.String("final_status", string(status)))
}

func (d *TestRunnerDispatcher) getKafkaProducer() (messaging.Producer, error) {
	if d.producerFactory != nil {
		return d.producerFactory()
	}
	cfg, err := confluent.BaseProducerConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to build producer config: %w", err)
	}
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, cfg)
}

func (d *TestRunnerDispatcher) sendJobUpdateEvent(job *oapi.Job, status oapi.JobStatus, message string) error {
	_, span := trTracer.Start(context.Background(), "TestRunnerDispatcher.sendJobUpdateEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("status", string(status)),
	)

	workspaceId := d.store.ID()

	// Create a copy of the job for the event - don't modify the original in the store
	// The event handler needs to see the previous status to trigger actions
	updatedAt := time.Now().UTC()
	jobCopy := *job
	jobCopy.Status = status
	jobCopy.UpdatedAt = updatedAt
	jobCopy.Message = &message
	if status == oapi.JobStatusSuccessful || status == oapi.JobStatusFailure {
		jobCopy.CompletedAt = &updatedAt
	}

	fieldsToUpdate := []oapi.JobUpdateEventFieldsToUpdate{
		oapi.JobUpdateEventFieldsToUpdateStatus,
		oapi.JobUpdateEventFieldsToUpdateMessage,
		oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
	}
	if jobCopy.CompletedAt != nil {
		fieldsToUpdate = append(fieldsToUpdate, oapi.JobUpdateEventFieldsToUpdateCompletedAt)
	}

	eventPayload := oapi.JobUpdateEvent{
		Id:             &jobCopy.Id,
		Job:            jobCopy,
		FieldsToUpdate: &fieldsToUpdate,
	}

	producer, err := d.getKafkaProducer()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create Kafka producer")
		return fmt.Errorf("failed to create Kafka producer: %w", err)
	}
	defer producer.Close()

	event := map[string]any{
		"eventType":   "job.updated",
		"workspaceId": workspaceId,
		"data":        eventPayload,
		"timestamp":   time.Now().Unix(),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal event")
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to publish event")
		return err
	}

	span.SetStatus(codes.Ok, "event published")
	return nil
}
