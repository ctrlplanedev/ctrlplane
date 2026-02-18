package testrunner

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("jobagents/testrunner")

var _ types.Dispatchable = &TestRunner{}

type TestRunner struct {
	store           *store.Store
	timeFunc        func(d time.Duration) <-chan time.Time
	producerFactory func() (messaging.Producer, error)
}

func New(store *store.Store) *TestRunner {
	return &TestRunner{
		store:    store,
		timeFunc: time.After,
	}
}

// Options contains optional configuration for testing.
type Options struct {
	TimeFunc        func(d time.Duration) <-chan time.Time
	ProducerFactory func() (messaging.Producer, error)
}

// NewWithOptions creates a TestRunner with custom options (useful for testing).
func NewWithOptions(store *store.Store, opts Options) *TestRunner {
	t := &TestRunner{
		store:           store,
		timeFunc:        time.After,
		producerFactory: opts.ProducerFactory,
	}
	if opts.TimeFunc != nil {
		t.timeFunc = opts.TimeFunc
	}
	return t
}

func (t *TestRunner) Type() string {
	return "test-runner"
}

func (t *TestRunner) Dispatch(ctx context.Context, job *oapi.Job) error {
	ctx, span := tracer.Start(ctx, "TestRunner.Dispatch")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", job.Id))

	cfg, err := job.GetTestRunnerJobAgentConfig()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		return err
	}

	delay := t.getDelay(cfg)
	finalStatus := t.getFinalStatus(cfg)
	message := ""
	if cfg.Message != nil {
		message = *cfg.Message
	}

	span.SetAttributes(
		attribute.Int64("delay_seconds", int64(delay.Seconds())),
		attribute.String("final_status", string(finalStatus)),
	)

	// Start a goroutine to resolve the job after the delay
	go t.resolveJobAfterDelay(context.WithoutCancel(ctx), job.Id, delay, finalStatus, message)

	span.SetStatus(codes.Ok, "test-runner scheduled")
	return nil
}

func (t *TestRunner) getDelay(cfg *oapi.TestRunnerJobAgentConfig) time.Duration {
	if cfg.DelaySeconds != nil {
		return time.Duration(*cfg.DelaySeconds) * time.Second
	}
	return 5 * time.Second // default delay
}

func (t *TestRunner) getFinalStatus(cfg *oapi.TestRunnerJobAgentConfig) oapi.JobStatus {
	if cfg.Status != nil && *cfg.Status == string(oapi.JobStatusFailure) {
		return oapi.JobStatusFailure
	}
	return oapi.JobStatusSuccessful
}

func (t *TestRunner) resolveJobAfterDelay(ctx context.Context, jobID string, delay time.Duration, status oapi.JobStatus, message string) {
	_, span := tracer.Start(ctx, "TestRunner.resolveJobAfterDelay")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", jobID),
		attribute.Int64("delay_seconds", int64(delay.Seconds())),
	)

	// Wait for the configured delay
	<-t.timeFunc(delay)

	// Get the current job state
	job, exists := t.store.Jobs.Get(jobID)
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
	resolveMsg := fmt.Sprintf("Resolved by test-runner after %v", delay)
	var finalMessage string
	if message != "" {
		finalMessage = message + "\n" + resolveMsg
	} else {
		finalMessage = resolveMsg
	}

	// Send job update event to Kafka queue
	if err := t.sendJobUpdateEvent(job, status, finalMessage); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to send job update event")
		return
	}

	span.SetStatus(codes.Ok, "job resolved by test-runner")
	span.SetAttributes(attribute.String("final_status", string(status)))
}

func (t *TestRunner) getKafkaProducer() (messaging.Producer, error) {
	if t.producerFactory != nil {
		return t.producerFactory()
	}
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
}

func (t *TestRunner) sendJobUpdateEvent(job *oapi.Job, status oapi.JobStatus, message string) error {
	_, span := tracer.Start(context.Background(), "TestRunner.sendJobUpdateEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("status", string(status)),
	)

	workspaceId := t.store.ID()

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

	producer, err := t.getKafkaProducer()
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
