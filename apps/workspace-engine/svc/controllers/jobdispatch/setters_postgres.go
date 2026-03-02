package jobdispatch

import (
	"context"
	"encoding/json"
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

// UpdateJob implements [testrunner.Setter].
func (s *PostgresSetter) UpdateJob(
	ctx context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	panic("unimplemented")
}

// CreateJobWithVerification implements [Setter].
func (s *PostgresSetter) CreateJobWithVerification(ctx context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	queries := db.GetQueries(ctx)

	jobID := uuid.MustParse(job.Id)
	releaseID := uuid.MustParse(job.ReleaseId)
	agentID := uuid.MustParse(job.JobAgentId)

	agentConfig, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("marshal job agent config: %w", err)
	}

	if err := queries.InsertJob(ctx, db.InsertJobParams{
		ID:             jobID,
		JobAgentID:     agentID,
		JobAgentConfig: agentConfig,
		Status:         db.JobStatus(job.Status),
		CreatedAt:      pgtype.Timestamptz{Time: job.CreatedAt, Valid: true},
		UpdatedAt:      pgtype.Timestamptz{Time: job.UpdatedAt, Valid: true},
	}); err != nil {
		return fmt.Errorf("insert job: %w", err)
	}

	if err := queries.InsertReleaseJob(ctx, db.InsertReleaseJobParams{
		ReleaseID: releaseID,
		JobID:     jobID,
	}); err != nil {
		return fmt.Errorf("insert release_job: %w", err)
	}

	if len(specs) == 0 {
		return nil
	}

	workspaceID, err := queries.GetWorkspaceIDByReleaseID(ctx, releaseID)
	if err != nil {
		return fmt.Errorf("get workspace id: %w", err)
	}

	for _, spec := range specs {
		providerJSON, err := spec.Provider.MarshalJSON()
		if err != nil {
			return fmt.Errorf("marshal provider for metric %q: %w", spec.Name, err)
		}

		metric, err := queries.InsertJobVerificationMetric(ctx, db.InsertJobVerificationMetricParams{
			JobID:            jobID,
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
			Kind:        "verification-metric",
			ScopeType:   "verification-metric",
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
