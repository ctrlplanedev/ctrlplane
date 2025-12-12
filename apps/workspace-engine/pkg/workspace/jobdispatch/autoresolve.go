package jobdispatch

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var arTracer = otel.Tracer("AutoResolveDispatcher")

// autoResolveJobConfig defines the configuration for auto-resolve jobs.
type autoResolveJobConfig struct {
	// DelaySeconds is the number of seconds to wait before auto-resolving the job.
	// If not specified, defaults to 5 seconds.
	DelaySeconds *int `json:"delaySeconds,omitempty"`
	// Status is the final status to set the job to.
	// Valid values: "completed", "failure". Defaults to "completed".
	Status *string `json:"status,omitempty"`
	// Message is an optional message to include in the job output.
	Message *string `json:"message,omitempty"`
}

// AutoResolveDispatcher is a test job dispatcher that automatically resolves jobs
// after a configurable delay. This is useful for testing and development scenarios
// where you want jobs to complete without actual external execution.
type AutoResolveDispatcher struct {
	store *store.Store
	// timeFunc allows overriding time.After for testing
	timeFunc func(d time.Duration) <-chan time.Time
}

// NewAutoResolveDispatcher creates a new auto-resolve dispatcher.
func NewAutoResolveDispatcher(store *store.Store) *AutoResolveDispatcher {
	return &AutoResolveDispatcher{
		store:    store,
		timeFunc: time.After,
	}
}

// NewAutoResolveDispatcherWithTimeFunc creates a dispatcher with a custom time function (useful for testing).
func NewAutoResolveDispatcherWithTimeFunc(store *store.Store, timeFunc func(d time.Duration) <-chan time.Time) *AutoResolveDispatcher {
	return &AutoResolveDispatcher{
		store:    store,
		timeFunc: timeFunc,
	}
}

func (d *AutoResolveDispatcher) parseConfig(job *oapi.Job) (autoResolveJobConfig, error) {
	var parsed autoResolveJobConfig

	if job.JobAgentConfig == nil {
		// Return default config if no config provided
		return parsed, nil
	}

	rawCfg, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return autoResolveJobConfig{}, fmt.Errorf("failed to marshal job agent config: %w", err)
	}

	if err := json.Unmarshal(rawCfg, &parsed); err != nil {
		return autoResolveJobConfig{}, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}

	// Validate status if provided
	if parsed.Status != nil {
		validStatuses := map[string]bool{
			"completed": true,
			"failure":   true,
		}
		if !validStatuses[*parsed.Status] {
			return autoResolveJobConfig{}, fmt.Errorf("invalid status '%s': must be 'completed' or 'failure'", *parsed.Status)
		}
	}

	return parsed, nil
}

func (d *AutoResolveDispatcher) getDelay(cfg autoResolveJobConfig) time.Duration {
	if cfg.DelaySeconds != nil {
		return time.Duration(*cfg.DelaySeconds) * time.Second
	}
	return 5 * time.Second // default delay
}

func (d *AutoResolveDispatcher) getFinalStatus(cfg autoResolveJobConfig) oapi.JobStatus {
	if cfg.Status != nil && *cfg.Status == "failure" {
		return oapi.JobStatusFailure
	}
	return oapi.JobStatusSuccessful
}

// DispatchJob starts the auto-resolve process for a job.
// It spawns a goroutine that waits for the configured delay and then updates the job status.
func (d *AutoResolveDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	ctx, span := arTracer.Start(ctx, "AutoResolveDispatcher.DispatchJob")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", job.Id))

	cfg, err := d.parseConfig(job)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		return err
	}

	delay := d.getDelay(cfg)
	finalStatus := d.getFinalStatus(cfg)
	message := ""
	if cfg.Message != nil {
		message = *cfg.Message
	}

	span.SetAttributes(
		attribute.Int64("delay_seconds", int64(delay.Seconds())),
		attribute.String("final_status", string(finalStatus)),
	)

	// Start a goroutine to auto-resolve the job after the delay
	go d.resolveJobAfterDelay(context.WithoutCancel(ctx), job.Id, delay, finalStatus, message)

	span.SetStatus(codes.Ok, "auto-resolve scheduled")
	return nil
}

func (d *AutoResolveDispatcher) resolveJobAfterDelay(ctx context.Context, jobID string, delay time.Duration, status oapi.JobStatus, message string) {
	_, span := arTracer.Start(ctx, "AutoResolveDispatcher.resolveJobAfterDelay")
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
		span.AddEvent("Job already in terminal state, skipping auto-resolve",
			oteltrace.WithAttributes(attribute.String("current_status", string(job.Status))))
		return
	}

	// Update job status
	job.Status = status
	job.UpdatedAt = time.Now()
	if message != "" {
		if job.Message == nil {
			job.Message = &message
		} else {
			combined := *job.Message + "\n" + message
			job.Message = &combined
		}
	}

	// Add auto-resolve marker message
	autoResolveMsg := fmt.Sprintf("Auto-resolved by test dispatcher after %v", delay)
	if job.Message == nil {
		job.Message = &autoResolveMsg
	} else {
		combined := *job.Message + "\n" + autoResolveMsg
		job.Message = &combined
	}

	d.store.Jobs.Upsert(ctx, job)

	span.SetStatus(codes.Ok, "job auto-resolved")
	span.SetAttributes(attribute.String("final_status", string(status)))
}

