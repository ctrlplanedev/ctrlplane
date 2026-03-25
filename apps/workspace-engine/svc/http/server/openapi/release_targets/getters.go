package release_targets

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type ReleaseTargetResult struct {
	ReleaseTarget  gin.H  `json:"releaseTarget"`
	Environment    gin.H  `json:"environment"`
	Resource       gin.H  `json:"resource"`
	DesiredVersion gin.H  `json:"desiredVersion,omitempty"`
	CurrentVersion gin.H  `json:"currentVersion,omitempty"`
	LatestJob      gin.H  `json:"latestJob,omitempty"`
}

type Getter interface {
	ListReleaseTargets(ctx context.Context, deploymentID string) ([]ReleaseTargetResult, error)
}

type PostgresGetter struct{}

var _ Getter = &PostgresGetter{}

var nilUUID = uuid.UUID{}

func (g *PostgresGetter) ListReleaseTargets(ctx context.Context, deploymentID string) ([]ReleaseTargetResult, error) {
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

	currentVersionMap := make(map[string]db.ListCurrentVersionsByDeploymentIDRow, len(currentVersions))
	for _, cv := range currentVersions {
		key := fmt.Sprintf("%s-%s-%s", cv.ResourceID.String(), cv.EnvironmentID.String(), cv.DeploymentID.String())
		currentVersionMap[key] = cv
	}

	var jobIDs []uuid.UUID
	for _, row := range rows {
		if row.LatestJobID != nilUUID {
			jobIDs = append(jobIDs, row.LatestJobID)
		}
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
				"id":               row.EnvironmentID.String(),
				"name":             row.EnvironmentName,
				"description":      row.EnvironmentDescription.String,
				"resourceSelector": row.EnvironmentResourceSelector,
				"metadata":         row.EnvironmentMetadata,
				"createdAt":        row.EnvironmentCreatedAt.Time,
				"workspaceId":      row.EnvironmentWorkspaceID.String(),
			},
			Resource: gin.H{
				"id":          row.ResourceID.String(),
				"name":        row.ResourceName,
				"version":     row.ResourceVersion,
				"kind":        row.ResourceKind,
				"identifier":  row.ResourceIdentifier,
				"providerId":  row.ResourceProviderID.String(),
				"workspaceId": row.ResourceWorkspaceID.String(),
				"config":      row.ResourceConfig,
				"createdAt":   row.ResourceCreatedAt.Time,
				"updatedAt":   row.ResourceUpdatedAt.Time,
				"deletedAt":   row.ResourceDeletedAt.Time,
				"metadata":    row.ResourceMetadata,
			},
		}

		if row.DesiredVersionID != nilUUID {
			item.DesiredVersion = gin.H{
				"id":             row.DesiredVersionID.String(),
				"name":           row.DesiredVersionName.String,
				"tag":            row.DesiredVersionTag.String,
				"config":         row.DesiredVersionConfig,
				"jobAgentConfig": row.DesiredVersionJobAgentConfig,
				"deploymentId":   row.DesiredVersionDeploymentID.String(),
				"metadata":       row.DesiredVersionMetadata,
				"status":         row.DesiredVersionStatus.DeploymentVersionStatus,
				"message":        row.DesiredVersionMessage.String,
				"createdAt":      row.DesiredVersionCreatedAt.Time,
			}
		}

		if row.LatestJobID != nilUUID {
			jobH := gin.H{
				"id":              row.LatestJobID.String(),
				"status":          row.LatestJobStatus.JobStatus,
				"message":         row.LatestJobMessage.String,
				"reason":          row.LatestJobReason.JobReason,
				"createdAt":       row.LatestJobCreatedAt.Time,
				"startedAt":       row.LatestJobStartedAt.Time,
				"completedAt":     row.LatestJobCompletedAt.Time,
				"updatedAt":       row.LatestJobUpdatedAt.Time,
				"externalId":      row.LatestJobExternalID.String,
				"jobAgentId":      row.LatestJobAgentID,
				"jobAgentConfig":  row.LatestJobAgentConfig,
				"dispatchContext": row.LatestJobDispatchContext,
			}
			if v, ok := verificationsMap[row.LatestJobID.String()]; ok {
				jobH["verifications"] = v
			} else {
				jobH["verifications"] = []gin.H{}
			}
			item.LatestJob = jobH
		}

		key := fmt.Sprintf("%s-%s-%s", row.ResourceID.String(), row.EnvironmentID.String(), row.DeploymentID.String())
		if cv, ok := currentVersionMap[key]; ok {
			item.CurrentVersion = gin.H{
				"id":             cv.VersionID.String(),
				"name":           cv.VersionName,
				"tag":            cv.VersionTag,
				"config":         cv.VersionConfig,
				"jobAgentConfig": cv.VersionJobAgentConfig,
				"deploymentId":   cv.VersionDeploymentID.String(),
				"metadata":       cv.VersionMetadata,
				"status":         cv.VersionStatus,
				"message":        cv.VersionMessage.String,
				"createdAt":      cv.VersionCreatedAt.Time,
			}
		}

		items[i] = item
	}

	return items, nil
}

func buildVerificationsMap(ctx context.Context, queries *db.Queries, jobIDs []uuid.UUID) map[string][]gin.H {
	verificationsMap := make(map[string][]gin.H)
	if len(jobIDs) == 0 {
		return verificationsMap
	}

	vRows, err := queries.ListVerificationMetricsByJobIDs(ctx, jobIDs)
	if err != nil {
		return verificationsMap
	}

	type metricEntry struct {
		metric       db.ListVerificationMetricsByJobIDsRow
		measurements []gin.H
	}
	byJob := make(map[string]map[string][]*metricEntry)

	for _, vr := range vRows {
		jobKey := vr.MetricJobID.String()
		groupKey := "ungrouped"
		if vr.MetricPolicyRuleID != nilUUID {
			groupKey = vr.MetricPolicyRuleID.String()
		}

		if byJob[jobKey] == nil {
			byJob[jobKey] = make(map[string][]*metricEntry)
		}

		var existing *metricEntry
		for _, me := range byJob[jobKey][groupKey] {
			if me.metric.MetricID == vr.MetricID {
				existing = me
				break
			}
		}
		if existing == nil {
			existing = &metricEntry{metric: vr}
			byJob[jobKey][groupKey] = append(byJob[jobKey][groupKey], existing)
		}

		if vr.MeasurementID != nilUUID {
			existing.measurements = append(existing.measurements, gin.H{
				"id":                            vr.MeasurementID.String(),
				"jobVerificationMetricStatusId": vr.MeasurementMetricID.String(),
				"data":                          vr.MeasurementData,
				"measuredAt":                    vr.MeasurementMeasuredAt.Time,
				"message":                       vr.MeasurementMessage.String,
				"status":                        vr.MeasurementStatus.JobVerificationStatus,
			})
		}
	}

	for jobKey, byRule := range byJob {
		var verifications []gin.H
		for groupKey, metrics := range byRule {
			verifID := groupKey
			if groupKey == "ungrouped" {
				verifID = jobKey
			}
			metricsJSON := make([]gin.H, len(metrics))
			for i, me := range metrics {
				metricsJSON[i] = gin.H{
					"id":                             me.metric.MetricID.String(),
					"createdAt":                      me.metric.MetricCreatedAt.Time,
					"jobId":                          me.metric.MetricJobID.String(),
					"policyRuleVerificationMetricId": me.metric.MetricPolicyRuleID.String(),
					"name":                           me.metric.MetricName,
					"provider":                       me.metric.MetricProvider,
					"intervalSeconds":                me.metric.MetricIntervalSeconds,
					"count":                          me.metric.MetricCount,
					"successCondition":               me.metric.MetricSuccessCondition,
					"successThreshold":               me.metric.MetricSuccessThreshold,
					"failureCondition":               me.metric.MetricFailureCondition.String,
					"failureThreshold":               me.metric.MetricFailureThreshold,
					"measurements":                   me.measurements,
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
