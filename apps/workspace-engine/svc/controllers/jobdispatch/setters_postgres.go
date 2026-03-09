package jobdispatch

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct {
	Queue reconcile.Queue
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
	// agentIDUUID, err := uuid.Parse(job.JobAgentId)
	// if err != nil {
	// 	return fmt.Errorf("parse agent id: %w", err)
	// }

	// agentConfig, err := json.Marshal(job.JobAgentConfig)
	// if err != nil {
	// 	return fmt.Errorf("marshal job agent config: %w", err)
	// }

	// if err := queries.InsertJob(ctx, db.InsertJobParams{
	// 	ID:             jobIDUUID,
	// 	JobAgentID:     pgtype.UUID{Bytes: agentIDUUID, Valid: true},
	// 	JobAgentConfig: agentConfig,
	// 	Status:         db.JobStatus(job.Status),
	// 	CreatedAt:      pgtype.Timestamptz{Time: job.CreatedAt, Valid: true},
	// 	UpdatedAt:      pgtype.Timestamptz{Time: job.UpdatedAt, Valid: true},
	// }); err != nil {
	// 	return fmt.Errorf("insert job: %w", err)
	// }

	// if err := queries.InsertReleaseJob(ctx, db.InsertReleaseJobParams{
	// 	ReleaseID: releaseIDUUID,
	// 	JobID:     jobIDUUID,
	// }); err != nil {
	// 	return fmt.Errorf("insert release_job: %w", err)
	// }

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
