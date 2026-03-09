package jobeligibility

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

type reconciler struct {
	workspaceID uuid.UUID

	getter Getter
	setter Setter
	rt     *ReleaseTarget

	release  *oapi.Release
	jobs     []*oapi.Job
	policies []*oapi.Policy
}

func (r *reconciler) loadInput(ctx context.Context) error {
	release, err := r.getter.GetDesiredRelease(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get desired release: %w", err)
	}
	if release == nil {
		return nil
	}
	r.release = release

	jobs, err := r.getter.GetJobsForReleaseTarget(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get jobs for release target: %w", err)
	}
	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].CreatedAt.After(jobs[j].CreatedAt)
	})
	r.jobs = jobs

	policies, err := r.getter.GetPoliciesForReleaseTarget(ctx, r.rt.ToOAPI())
	if err != nil {
		return fmt.Errorf("get policies for release target: %w", err)
	}
	r.policies = policies

	return nil
}

// checkEligibility evaluates whether a job should be created for the desired release.
// Returns (allowed, nextTime, reason).
func (r *reconciler) checkEligibility(ctx context.Context) (bool, *time.Time, string) {
	if r.release == nil {
		return false, nil, "no desired release"
	}

	// Phase 1: Concurrency check — deny if any job is still in a processing state
	for _, job := range r.jobs {
		if isProcessingStatus(job.Status) {
			return false, nil, fmt.Sprintf("release target has active job %s (status: %s)", job.Id, job.Status)
		}
	}

	// Phase 2: Retry check — extract retry rules from policies, evaluate limits and backoff
	retryRule := r.extractRetryRule()
	allowed, nextTime, reason := r.evaluateRetry(retryRule)
	return allowed, nextTime, reason
}

func (r *reconciler) extractRetryRule() *oapi.RetryRule {
	for _, policy := range r.policies {
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			if rule.Retry != nil {
				return rule.Retry
			}
		}
	}
	return nil
}

// evaluateRetry checks retry limits and backoff for the desired release.
// When no retry rule is configured, allows one attempt only (maxRetries=0).
func (r *reconciler) evaluateRetry(rule *oapi.RetryRule) (bool, *time.Time, string) {
	maxRetries := int32(0)
	var backoffSeconds *int32
	var backoffStrategy *oapi.RetryRuleBackoffStrategy
	var maxBackoffSeconds *int32
	var retryOnStatuses *[]oapi.JobStatus

	if rule != nil {
		maxRetries = rule.MaxRetries
		backoffSeconds = rule.BackoffSeconds
		backoffStrategy = rule.BackoffStrategy
		maxBackoffSeconds = rule.MaxBackoffSeconds
		retryOnStatuses = rule.RetryOnStatuses
	}

	// Build retryable status set; nil means count all terminal statuses
	retryableStatuses := buildRetryableStatusMap(retryOnStatuses, rule != nil, maxRetries)

	// Count consecutive attempts for this exact release, newest first
	attemptCount := 0
	var mostRecentJob *oapi.Job
	var mostRecentTime time.Time

	for _, job := range r.jobs {
		if job.ReleaseId != r.release.Id.String() {
			break
		}
		isRetryable := retryableStatuses == nil || retryableStatuses[job.Status]
		if !isRetryable {
			break
		}
		attemptCount++
		jobTime := job.CreatedAt
		if job.CompletedAt != nil {
			jobTime = *job.CompletedAt
		}
		if mostRecentJob == nil || jobTime.After(mostRecentTime) {
			mostRecentJob = job
			mostRecentTime = jobTime
		}
	}

	if attemptCount > int(maxRetries) {
		return false, nil, fmt.Sprintf("retry limit exceeded (%d/%d attempts)", attemptCount, maxRetries)
	}

	// Backoff check
	if attemptCount > 0 && backoffSeconds != nil && *backoffSeconds > 0 && mostRecentJob != nil {
		backoffDuration := calculateBackoff(attemptCount, *backoffSeconds, backoffStrategy, maxBackoffSeconds)
		nextAllowed := mostRecentTime.Add(backoffDuration)
		if time.Now().Before(nextAllowed) {
			return false, &nextAllowed, fmt.Sprintf("waiting for retry backoff (%ds remaining)", int(time.Until(nextAllowed).Seconds()))
		}
	}

	if attemptCount == 0 {
		return true, nil, "first attempt"
	}
	return true, nil, fmt.Sprintf("retry allowed (%d/%d attempts)", attemptCount, maxRetries)
}

func (r *reconciler) buildAndDispatchJob(ctx context.Context) error {
	deploymentID, err := uuid.Parse(r.release.ReleaseTarget.DeploymentId)
	if err != nil {
		return fmt.Errorf("parse deployment id: %w", err)
	}

	deployment, err := r.getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return fmt.Errorf("get deployment: %w", err)
	}

	if deployment.JobAgents == nil || len(*deployment.JobAgents) == 0 {
		return fmt.Errorf("no job agents configured for deployment %s", deployment.Name)
	}

	for _, agentRef := range *deployment.JobAgents {
		agentID, err := uuid.Parse(agentRef.Ref)
		if err != nil {
			return fmt.Errorf("parse job agent id: %w", err)
		}

		jobAgent, err := r.getter.GetJobAgent(ctx, agentID)
		if err != nil {
			return fmt.Errorf("get job agent %s: %w", agentRef.Ref, err)
		}

		job, err := r.buildJob(ctx, jobAgent, deployment)
		if err != nil {
			return fmt.Errorf("build job: %w", err)
		}

		if err := r.setter.CreateJob(ctx, job); err != nil {
			return fmt.Errorf("create job: %w", err)
		}

		if err := r.setter.EnqueueJobDispatch(ctx, r.workspaceID.String(), job.Id); err != nil {
			return fmt.Errorf("enqueue job dispatch: %w", err)
		}
	}

	return nil
}

func (r *reconciler) buildJob(ctx context.Context, jobAgent *oapi.JobAgent, deployment *oapi.Deployment) (*oapi.Job, error) {
	environmentID, err := uuid.Parse(r.release.ReleaseTarget.EnvironmentId)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	resourceID, err := uuid.Parse(r.release.ReleaseTarget.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}

	environment, err := r.getter.GetEnvironment(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment: %w", err)
	}

	resource, err := r.getter.GetResource(ctx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource: %w", err)
	}

	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      r.release.Id.String(),
		JobAgentId:     jobAgent.Id,
		JobAgentConfig: jobAgent.Config,
		Status:         oapi.JobStatusPending,
		CreatedAt:      now,
		UpdatedAt:      now,
		Metadata:       make(map[string]string),
		DispatchContext: &oapi.DispatchContext{
			Release:        r.release,
			Deployment:     deployment,
			Environment:    environment,
			Resource:       resource,
			JobAgent:       *jobAgent,
			JobAgentConfig: jobAgent.Config,
			Version:        &r.release.Version,
			Variables:      &r.release.Variables,
		},
	}, nil
}

// Reconcile determines job eligibility for a release target and, if eligible,
// builds a job and enqueues it for dispatch.
func Reconcile(ctx context.Context, workspaceID string, getter Getter, setter Setter, rt *ReleaseTarget) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobeligibility.Reconcile")
	defer span.End()

	workspaceIDUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	r := &reconciler{workspaceID: workspaceIDUUID, getter: getter, setter: setter, rt: rt}
	r.rt.WorkspaceID = r.workspaceID

	if err := r.loadInput(ctx); err != nil {
		return nil, recordErr(span, "load input", err)
	}

	if r.release == nil {
		return &ReconcileResult{}, nil
	}

	allowed, nextTime, reason := r.checkEligibility(ctx)
	if !allowed {
		if nextTime != nil {
			// Pending — schedule re-evaluation
			return &ReconcileResult{NextReconcileAt: nextTime}, nil
		}
		// Denied — nothing to do
		span.AddEvent("job creation denied: " + reason)
		return &ReconcileResult{}, nil
	}

	span.AddEvent("job creation allowed: " + reason)
	if err := r.buildAndDispatchJob(ctx); err != nil {
		return nil, recordErr(span, "build and dispatch job", err)
	}

	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}

func isProcessingStatus(status oapi.JobStatus) bool {
	return status == oapi.JobStatusPending ||
		status == oapi.JobStatusInProgress ||
		status == oapi.JobStatusActionRequired
}

func buildRetryableStatusMap(retryOnStatuses *[]oapi.JobStatus, hasPolicyRule bool, maxRetries int32) map[oapi.JobStatus]bool {
	if !hasPolicyRule {
		// No policy: count ALL statuses (strict mode, one attempt only)
		return nil
	}

	if retryOnStatuses != nil && len(*retryOnStatuses) > 0 {
		m := make(map[oapi.JobStatus]bool, len(*retryOnStatuses))
		for _, s := range *retryOnStatuses {
			m[s] = true
		}
		return m
	}

	// Smart defaults when policy exists but retryOnStatuses is not specified
	defaults := map[oapi.JobStatus]bool{
		oapi.JobStatusFailure:            true,
		oapi.JobStatusInvalidIntegration: true,
		oapi.JobStatusInvalidJobAgent:    true,
	}
	if maxRetries == 0 {
		defaults[oapi.JobStatusSuccessful] = true
	}
	return defaults
}

func calculateBackoff(attemptCount int, baseBackoffSeconds int32, strategy *oapi.RetryRuleBackoffStrategy, maxBackoffSeconds *int32) time.Duration {
	s := oapi.RetryRuleBackoffStrategyLinear
	if strategy != nil {
		s = *strategy
	}

	var seconds int32
	switch s {
	case oapi.RetryRuleBackoffStrategyExponential:
		exponent := max(attemptCount-1, 0)
		multiplier := math.Pow(2, float64(exponent))
		seconds = int32(float64(baseBackoffSeconds) * multiplier)
		if maxBackoffSeconds != nil && seconds > *maxBackoffSeconds {
			seconds = *maxBackoffSeconds
		}
	default:
		seconds = baseBackoffSeconds
	}

	return time.Duration(seconds) * time.Second
}
