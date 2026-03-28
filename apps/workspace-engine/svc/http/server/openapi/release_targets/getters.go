package release_targets

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type ReleaseTargetResult struct {
	ReleaseTarget  gin.H `json:"releaseTarget"`
	Environment    gin.H `json:"environment"`
	Resource       gin.H `json:"resource"`
	DesiredVersion gin.H `json:"desiredVersion,omitempty"`
	CurrentVersion gin.H `json:"currentVersion,omitempty"`
	LatestJob      gin.H `json:"latestJob,omitempty"`
}

type Getter interface {
	ListReleaseTargets(ctx context.Context, deploymentID string) ([]ReleaseTargetResult, error)

	GetDesiredRelease(ctx context.Context, rt oapi.ReleaseTarget) (*oapi.Release, error)
	GetCurrentRelease(ctx context.Context, rt oapi.ReleaseTarget) (*oapi.Release, error)
	GetLatestJobWithMetadata(ctx context.Context, rt oapi.ReleaseTarget) (*oapi.Job, error)
	GetJobVerifications(ctx context.Context, jobID uuid.UUID) ([]oapi.JobVerification, error)
}

type PostgresGetter struct{}

var _ Getter = &PostgresGetter{}

var nilUUID = uuid.UUID{}

func (g *PostgresGetter) ListReleaseTargets(
	ctx context.Context,
	deploymentID string,
) ([]ReleaseTargetResult, error) {
	id, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("invalid deployment id: %w", err)
	}

	queries := db.GetQueries(ctx)

	rows, err := queries.ListReleaseTargetsByDeploymentID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("list release targets: %w", err)
	}

	currentVersions, err := queries.ListCurrentVersionsByDeploymentID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("list current versions: %w", err)
	}

	currentVersionMap := make(
		map[string]db.ListCurrentVersionsByDeploymentIDRow,
		len(currentVersions),
	)
	for _, cv := range currentVersions {
		key := fmt.Sprintf(
			"%s-%s-%s",
			cv.ResourceID.String(),
			cv.EnvironmentID.String(),
			cv.DeploymentID.String(),
		)
		currentVersionMap[key] = cv
	}

	latestJobs, err := queries.ListLatestJobsByDeploymentID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("list latest jobs: %w", err)
	}

	latestJobMap := make(map[string]db.ListLatestJobsByDeploymentIDRow, len(latestJobs))
	var jobIDs []uuid.UUID
	for _, lj := range latestJobs {
		key := fmt.Sprintf(
			"%s-%s-%s",
			lj.ResourceID.String(),
			lj.EnvironmentID.String(),
			lj.DeploymentID.String(),
		)
		latestJobMap[key] = lj
		jobIDs = append(jobIDs, lj.JobID)
	}

	verificationsMap := buildVerificationsMap(ctx, queries, jobIDs)

	items := make([]ReleaseTargetResult, len(rows))
	for i, row := range rows {
		item := ReleaseTargetResult{
			ReleaseTarget: gin.H{
				"resourceId":    row.ResourceID.String(),
				"environmentId": row.EnvironmentID.String(),
				"deploymentId":  row.DeploymentID.String(),
			},
			Environment: gin.H{
				"id":   row.EnvironmentID.String(),
				"name": row.EnvironmentName,
			},
			Resource: gin.H{
				"id":         row.ResourceID.String(),
				"name":       row.ResourceName,
				"version":    row.ResourceVersion,
				"kind":       row.ResourceKind,
				"identifier": row.ResourceIdentifier,
			},
		}

		if row.DesiredVersionID != nilUUID {
			item.DesiredVersion = gin.H{
				"id":   row.DesiredVersionID.String(),
				"name": row.DesiredVersionName.String,
				"tag":  row.DesiredVersionTag.String,
			}
		}

		key := fmt.Sprintf(
			"%s-%s-%s",
			row.ResourceID.String(),
			row.EnvironmentID.String(),
			row.DeploymentID.String(),
		)
		if cv, ok := currentVersionMap[key]; ok {
			item.CurrentVersion = gin.H{
				"id":   cv.VersionID.String(),
				"name": cv.VersionName,
				"tag":  cv.VersionTag,
			}
		}

		if lj, ok := latestJobMap[key]; ok {
			jobH := gin.H{
				"id":        lj.JobID.String(),
				"status":    lj.JobStatus,
				"message":   lj.JobMessage.String,
				"metadata":  json.RawMessage(lj.JobMetadata),
				"createdAt": lj.JobCreatedAt.Time,
			}
			if v, ok := verificationsMap[lj.JobID.String()]; ok {
				jobH["verifications"] = v
			} else {
				jobH["verifications"] = []gin.H{}
			}
			item.LatestJob = jobH
		}

		items[i] = item
	}

	return items, nil
}

func parseReleaseTargetUUIDs(rt oapi.ReleaseTarget) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	resourceID, err := uuid.Parse(rt.ResourceId)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, uuid.UUID{}, fmt.Errorf("invalid resource id: %w", err)
	}
	environmentID, err := uuid.Parse(rt.EnvironmentId)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, uuid.UUID{}, fmt.Errorf("invalid environment id: %w", err)
	}
	deploymentID, err := uuid.Parse(rt.DeploymentId)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, uuid.UUID{}, fmt.Errorf("invalid deployment id: %w", err)
	}
	return resourceID, environmentID, deploymentID, nil
}

func (g *PostgresGetter) GetDesiredRelease(
	ctx context.Context,
	rt oapi.ReleaseTarget,
) (*oapi.Release, error) {
	resourceID, environmentID, deploymentID, err := parseReleaseTargetUUIDs(rt)
	if err != nil {
		return nil, err
	}

	queries := db.GetQueries(ctx)
	row, err := queries.GetDesiredReleaseByReleaseTarget(
		ctx,
		db.GetDesiredReleaseByReleaseTargetParams{
			ResourceID:    resourceID,
			EnvironmentID: environmentID,
			DeploymentID:  deploymentID,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get desired release: %w", err)
	}

	return db.ToOapiFullRelease(row), nil
}

func (g *PostgresGetter) GetCurrentRelease(
	ctx context.Context,
	rt oapi.ReleaseTarget,
) (*oapi.Release, error) {
	resourceID, environmentID, deploymentID, err := parseReleaseTargetUUIDs(rt)
	if err != nil {
		return nil, err
	}

	queries := db.GetQueries(ctx)
	row, err := queries.GetCurrentReleaseByReleaseTarget(
		ctx,
		db.GetCurrentReleaseByReleaseTargetParams{
			ResourceID:    resourceID,
			EnvironmentID: environmentID,
			DeploymentID:  deploymentID,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get current release: %w", err)
	}

	return db.ToOapiFullRelease(db.GetDesiredReleaseByReleaseTargetRow(row)), nil
}

func (g *PostgresGetter) GetLatestJobWithMetadata(
	ctx context.Context,
	rt oapi.ReleaseTarget,
) (*oapi.Job, error) {
	resourceID, environmentID, deploymentID, err := parseReleaseTargetUUIDs(rt)
	if err != nil {
		return nil, err
	}

	queries := db.GetQueries(ctx)
	row, err := queries.GetLatestJobByReleaseTarget(ctx, db.GetLatestJobByReleaseTargetParams{
		DeploymentID:  deploymentID,
		EnvironmentID: environmentID,
		ResourceID:    resourceID,
	})
	if err != nil {
		return nil, fmt.Errorf("get latest job: %w", err)
	}

	return db.ToOapiJob(db.ListJobsByReleaseIDRow(row)), nil
}

func (g *PostgresGetter) GetJobVerifications(
	ctx context.Context,
	jobID uuid.UUID,
) ([]oapi.JobVerification, error) {
	queries := db.GetQueries(ctx)
	rows, err := queries.GetJobVerificationsWithMeasurements(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("get job verifications: %w", err)
	}

	if len(rows) == 0 {
		return []oapi.JobVerification{}, nil
	}

	byPolicyRule := make(map[string][]db.GetJobVerificationsWithMeasurementsRow)
	for _, row := range rows {
		groupKey := "ungrouped"
		if row.PolicyRuleVerificationMetricID != nilUUID {
			groupKey = row.PolicyRuleVerificationMetricID.String()
		}
		byPolicyRule[groupKey] = append(byPolicyRule[groupKey], row)
	}

	var verifications []oapi.JobVerification
	for groupKey, metrics := range byPolicyRule {
		verifID := groupKey
		if groupKey == "ungrouped" {
			verifID = jobID.String()
		}

		oapiMetrics := make([]oapi.VerificationMetricStatus, len(metrics))
		for i, m := range metrics {
			measurements := parseMeasurements(m.Measurements)

			metric := oapi.VerificationMetricStatus{
				Id:               m.ID.String(),
				Name:             m.Name,
				IntervalSeconds:  m.IntervalSeconds,
				Count:            int(m.Count),
				SuccessCondition: m.SuccessCondition,
				Measurements:     measurements,
			}

			var provider oapi.MetricProvider
			if err := json.Unmarshal(m.Provider, &provider); err == nil {
				metric.Provider = provider
			}

			if m.SuccessThreshold.Valid {
				st := int(m.SuccessThreshold.Int32)
				metric.SuccessThreshold = &st
			}
			if m.FailureCondition.Valid {
				metric.FailureCondition = &m.FailureCondition.String
			}
			if m.FailureThreshold.Valid {
				ft := int(m.FailureThreshold.Int32)
				metric.FailureThreshold = &ft
			}

			oapiMetrics[i] = metric
		}

		verifications = append(verifications, oapi.JobVerification{
			Id:        verifID,
			JobId:     jobID.String(),
			CreatedAt: metrics[0].CreatedAt.Time,
			Metrics:   oapiMetrics,
		})
	}

	return verifications, nil
}

type dbMeasurement struct {
	ID         string         `json:"id"`
	Data       map[string]any `json:"data"`
	MeasuredAt time.Time      `json:"measured_at"`
	Message    string         `json:"message"`
	Status     string         `json:"status"`
}

func parseMeasurements(raw []byte) []oapi.VerificationMeasurement {
	var dbMs []dbMeasurement
	if err := json.Unmarshal(raw, &dbMs); err != nil {
		return []oapi.VerificationMeasurement{}
	}
	result := make([]oapi.VerificationMeasurement, len(dbMs))
	for i, m := range dbMs {
		result[i] = oapi.VerificationMeasurement{
			Data:       m.Data,
			MeasuredAt: m.MeasuredAt,
			Status:     oapi.VerificationMeasurementStatus(m.Status),
		}
		if m.Message != "" {
			result[i].Message = &m.Message
		}
	}
	return result
}

func buildVerificationsMap(
	ctx context.Context,
	queries *db.Queries,
	jobIDs []uuid.UUID,
) map[string][]gin.H {
	verificationsMap := make(map[string][]gin.H)
	if len(jobIDs) == 0 {
		return verificationsMap
	}

	vRows, err := queries.ListVerificationMetricsByJobIDs(ctx, jobIDs)
	if err != nil {
		return verificationsMap
	}

	byJob := make(map[string]map[string][]db.ListVerificationMetricsByJobIDsRow)

	for _, vr := range vRows {
		jobKey := vr.MetricJobID.String()
		groupKey := "ungrouped"
		if vr.MetricPolicyRuleID != nilUUID {
			groupKey = vr.MetricPolicyRuleID.String()
		}

		if byJob[jobKey] == nil {
			byJob[jobKey] = make(map[string][]db.ListVerificationMetricsByJobIDsRow)
		}
		byJob[jobKey][groupKey] = append(byJob[jobKey][groupKey], vr)
	}

	for jobKey, byRule := range byJob {
		var verifications []gin.H
		for groupKey, metrics := range byRule {
			verifID := groupKey
			if groupKey == "ungrouped" {
				verifID = jobKey
			}
			metricsJSON := make([]gin.H, len(metrics))
			for i, m := range metrics {
				metricsJSON[i] = gin.H{
					"id":                             m.MetricID.String(),
					"jobId":                          m.MetricJobID.String(),
					"policyRuleVerificationMetricId": m.MetricPolicyRuleID.String(),
					"name":                           m.MetricName,
					"provider":                       json.RawMessage(m.MetricProvider),
					"count":                          m.MetricCount,
					"successCondition":               m.MetricSuccessCondition,
					"successThreshold":               m.MetricSuccessThreshold,
					"failureCondition":               m.MetricFailureCondition.String,
					"failureThreshold":               m.MetricFailureThreshold,
				}
			}
			verifications = append(verifications, gin.H{
				"id":      verifID,
				"jobId":   jobKey,
				"metrics": metricsJSON,
			})
		}
		verificationsMap[jobKey] = verifications
	}

	return verificationsMap
}
