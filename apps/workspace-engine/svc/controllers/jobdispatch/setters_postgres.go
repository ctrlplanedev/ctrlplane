package jobdispatch

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct {
	Queue reconcile.Queue
}

func (s *PostgresSetter) getExistingJob(ctx context.Context, jobID string) (*oapi.Job, error) {
	jobIDUUID, err := uuid.Parse(jobID)
	if err != nil {
		return nil, nil
	}

	jobRow, err := db.GetQueries(ctx).GetJobByID(ctx, jobIDUUID)
	if err != nil {
		return nil, fmt.Errorf("get job by id: %w", err)
	}

	return db.ToOapiJobFromGetJobByIDRow(jobRow), nil
}

func (s *PostgresSetter) UpdateJob(
	ctx context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	jobIDUUID, err := uuid.Parse(jobID)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}

	queries := db.GetQueries(ctx)

	existingJob, err := s.getExistingJob(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get existing job: %w", err)
	}

	if err := queries.UpdateJobStatus(ctx, db.UpdateJobStatusParams{
		ID:      jobIDUUID,
		Status:  db.JobStatus(status),
		Message: pgtype.Text{String: message, Valid: true},
	}); err != nil {
		return fmt.Errorf("update job status: %w", err)
	}

	for k, v := range metadata {
		if err := queries.UpsertJobMetadata(ctx, db.UpsertJobMetadataParams{
			JobID: jobIDUUID,
			Key:   k,
			Value: v,
		}); err != nil {
			return fmt.Errorf("upsert job metadata: %w", err)
		}
	}

	if existingJob != nil && existingJob.Status == status {
		workspaceID, err := queries.GetWorkspaceIDByJobID(ctx, jobIDUUID)
		if err != nil {
			return fmt.Errorf("get workspace id by job id: %w", err)
		}

		allReleaseTargets, err := queries.GetReleaseTargetsForWorkspace(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("get release targets for workspace: %w", err)
		}

		params := make([]events.DesiredReleaseEvalParams, len(allReleaseTargets))
		for i, releaseTarget := range allReleaseTargets {
			params[i] = events.DesiredReleaseEvalParams{
				WorkspaceID:   workspaceID.String(),
				ResourceID:    releaseTarget.ResourceID.String(),
				EnvironmentID: releaseTarget.EnvironmentID.String(),
				DeploymentID:  releaseTarget.DeploymentID.String(),
			}
		}

		if err := events.EnqueueManyDesiredRelease(s.Queue, ctx, params); err != nil {
			return fmt.Errorf("enqueue many desired release: %w", err)
		}
	}

	return nil
}

func (s *PostgresSetter) CreateVerifications(ctx context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	queries := db.GetQueries(ctx)

	jobIDUUID, err := uuid.Parse(job.Id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}
	releaseIDUUID, err := uuid.Parse(job.ReleaseId)
	if err != nil {
		return fmt.Errorf("parse release id: %w", err)
	}

	if len(specs) == 0 {
		return nil
	}

	workspaceID, err := queries.GetWorkspaceIDByReleaseID(ctx, releaseIDUUID)
	if err != nil {
		return fmt.Errorf("get workspace id: %w", err)
	}

	for _, spec := range specs {
		providerJSON, err := spec.Provider.MarshalJSON()
		if err != nil {
			return fmt.Errorf("marshal provider for metric %q: %w", spec.Name, err)
		}

		metric, err := queries.InsertJobVerificationMetric(ctx, db.InsertJobVerificationMetricParams{
			JobID:            jobIDUUID,
			Name:             spec.Name,
			Provider:         providerJSON,
			IntervalSeconds:  spec.IntervalSeconds,
			Count:            int32(spec.Count),
			SuccessCondition: spec.SuccessCondition,
			SuccessThreshold: toPgInt4(spec.SuccessThreshold),
			FailureCondition: toPgText(spec.FailureCondition),
			FailureThreshold: toPgInt4(spec.FailureThreshold),
		})
		if err != nil {
			return fmt.Errorf("insert verification metric %q: %w", spec.Name, err)
		}

		if err := s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
			WorkspaceID: workspaceID.String(),
			Kind:        "job-verification-metric",
			ScopeType:   "job-verification-metric",
			ScopeID:     metric.ID.String(),
		}); err != nil {
			return fmt.Errorf("enqueue verification metric %q: %w", spec.Name, err)
		}
	}

	return nil
}

func toPgInt4(v *int) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*v), Valid: true}
}

func toPgText(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *v, Valid: true}
}
