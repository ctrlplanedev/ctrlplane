package environmentprogression

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/store/releasetargets"
)

var gettersTracer = otel.Tracer(
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression/getters",
)

type environmentGetter = store.EnvironmentGetter
type deploymentGetter = store.DeploymentGetter
type resourceGetter = store.ResourceGetter
type releaseGetter = store.ReleaseGetter

type releaseTargetForDeploymentAndEnvironmentGetter = releasetargets.GetReleaseTargetsForDeploymentAndEnvironment
type releaseTargetForDeploymentGetter = releasetargets.GetReleaseTargetsForDeployment
type jobsForReleaseTargetGetter = releasetargets.GetJobsForReleaseTarget

type Getters interface {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter

	releaseTargetForDeploymentAndEnvironmentGetter
	releaseTargetForDeploymentGetter

	GetSystemIDsForEnvironment(environmentID string) []string
	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
	GetAllPolicies(ctx context.Context, workspaceID string) (map[string]*oapi.Policy, error)
	GetReleaseByJobID(ctx context.Context, jobID string) (*oapi.Release, error)
	GetJobsForEnvironmentAndVersion(
		ctx context.Context,
		environmentID string,
		versionID string,
	) ([]ReleaseTargetJob, error)
	GetVerificationStatusForJobs(
		ctx context.Context,
		jobIDs []string,
	) (map[string]oapi.JobVerificationStatus, error)
}

// ReleaseTargetJob holds the minimal job fields needed by the job tracker,
// along with the release target triple identifying which target the job belongs to.
type ReleaseTargetJob struct {
	JobID         string
	Status        oapi.JobStatus
	CompletedAt   *time.Time
	DeploymentID  string
	EnvironmentID string
	ResourceID    string
}

// ---------------------------------------------------------------------------
// Postgres-backed implementation
// ---------------------------------------------------------------------------

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter
	releaseTargetForDeploymentAndEnvironmentGetter
	releaseTargetForDeploymentGetter
	jobsForReleaseTargetGetter

	queries *db.Queries
}

func NewPostgresGetters(
	queries *db.Queries,
	rtForDep releasetargets.GetReleaseTargetsForDeployment,
	rtForDepEnv releasetargets.GetReleaseTargetsForDeploymentAndEnvironment,
	jobsForRT releasetargets.GetJobsForReleaseTarget,
) *PostgresGetters {
	if rtForDep == nil {
		rtForDep = releasetargets.NewGetReleaseTargetsForDeployment()
	}
	if rtForDepEnv == nil {
		rtForDepEnv = releasetargets.NewGetReleaseTargetsForDeploymentAndEnvironment()
	}
	if jobsForRT == nil {
		jobsForRT = releasetargets.NewGetJobsForReleaseTarget()
	}
	return &PostgresGetters{
		queries:           queries,
		environmentGetter: store.NewPostgresEnvironmentGetter(queries),
		deploymentGetter:  store.NewPostgresDeploymentGetter(queries),
		resourceGetter:    store.NewPostgresResourceGetter(queries),
		releaseGetter:     store.NewPostgresReleaseGetter(queries),
		releaseTargetForDeploymentAndEnvironmentGetter: rtForDepEnv,
		releaseTargetForDeploymentGetter:               rtForDep,
		jobsForReleaseTargetGetter:                     jobsForRT,
	}
}

func (p *PostgresGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	ctx := context.TODO()
	ids, err := p.queries.GetSystemIDsForEnvironment(ctx, uuid.MustParse(environmentID))
	if err != nil {
		return nil
	}
	result := make([]string, len(ids))
	for i, id := range ids {
		result[i] = id.String()
	}
	return result
}

func (p *PostgresGetters) GetReleaseTargetsForEnvironment(
	ctx context.Context,
	environmentID string,
) ([]*oapi.ReleaseTarget, error) {
	envUUID := uuid.MustParse(environmentID)
	systemIDs, err := p.queries.GetSystemIDsForEnvironment(ctx, envUUID)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	var targets []*oapi.ReleaseTarget

	for _, systemID := range systemIDs {
		deploymentIDs, err := p.queries.GetDeploymentIDsForSystem(ctx, systemID)
		if err != nil {
			return nil, err
		}
		for _, depID := range deploymentIDs {
			rows, err := p.queries.GetReleaseTargetsForDeployment(ctx, depID)
			if err != nil {
				return nil, err
			}
			for _, row := range rows {
				if row.EnvironmentID != envUUID {
					continue
				}
				key := row.DeploymentID.String() + "/" + row.EnvironmentID.String() + "/" + row.ResourceID.String()
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				targets = append(targets, &oapi.ReleaseTarget{
					DeploymentId:  row.DeploymentID.String(),
					EnvironmentId: row.EnvironmentID.String(),
					ResourceId:    row.ResourceID.String(),
				})
			}
		}
	}
	return targets, nil
}

func (p *PostgresGetters) GetAllPolicies(
	ctx context.Context,
	workspaceID string,
) (map[string]*oapi.Policy, error) {
	rows, err := p.queries.ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: uuid.MustParse(workspaceID),
	})
	if err != nil {
		return nil, err
	}
	result := make(map[string]*oapi.Policy, len(rows))
	for _, row := range rows {
		pol := db.ToOapiPolicy(row)
		result[pol.Id] = pol
	}
	return result, nil
}

func (p *PostgresGetters) GetJobsForEnvironmentAndVersion(
	ctx context.Context,
	environmentID string,
	versionID string,
) ([]ReleaseTargetJob, error) {
	ctx, span := gettersTracer.Start(ctx, "GetJobsForEnvironmentAndVersion")
	defer span.End()

	span.SetAttributes(
		attribute.String("environment_id", environmentID),
		attribute.String("version_id", versionID),
	)

	rows, err := p.queries.ListJobsByEnvironmentAndVersion(
		ctx,
		db.ListJobsByEnvironmentAndVersionParams{
			EnvironmentID: uuid.MustParse(environmentID),
			VersionID:     uuid.MustParse(versionID),
		},
	)
	if err != nil {
		return nil, err
	}

	span.SetAttributes(attribute.Int("jobs.count", len(rows)))

	result := make([]ReleaseTargetJob, len(rows))
	for i, row := range rows {
		rtj := ReleaseTargetJob{
			JobID:         row.ID.String(),
			Status:        db.ToOapiJobStatus(row.Status),
			DeploymentID:  row.DeploymentID.String(),
			EnvironmentID: row.EnvironmentID.String(),
			ResourceID:    row.ResourceID.String(),
		}
		if row.CompletedAt.Valid {
			t := row.CompletedAt.Time
			rtj.CompletedAt = &t
		}
		result[i] = rtj
	}
	return result, nil
}

func (p *PostgresGetters) GetVerificationStatusForJobs(
	ctx context.Context,
	jobIDs []string,
) (map[string]oapi.JobVerificationStatus, error) {
	ctx, span := gettersTracer.Start(ctx, "GetVerificationStatusForJobs")
	defer span.End()

	uuids := make([]uuid.UUID, len(jobIDs))
	for i, id := range jobIDs {
		uuids[i] = uuid.MustParse(id)
	}

	rows, err := p.queries.ListVerificationMetricsWithMeasurementsByJobIDs(ctx, uuids)
	if err != nil {
		return nil, err
	}

	// Group rows by job -> metric -> measurements
	type metricData struct {
		count            int
		failureThreshold *int
		successThreshold *int
		measurements     []oapi.VerificationMeasurementStatus
	}
	// jobID -> metricID -> metricData
	byJob := make(map[string]map[string]*metricData)

	for _, row := range rows {
		jobKey := row.JobID.String()
		metricKey := row.MetricID.String()

		if byJob[jobKey] == nil {
			byJob[jobKey] = make(map[string]*metricData)
		}
		md, exists := byJob[jobKey][metricKey]
		if !exists {
			md = &metricData{count: int(row.Count)}
			if row.FailureThreshold.Valid {
				v := int(row.FailureThreshold.Int32)
				md.failureThreshold = &v
			}
			if row.SuccessThreshold.Valid {
				v := int(row.SuccessThreshold.Int32)
				md.successThreshold = &v
			}
			byJob[jobKey][metricKey] = md
		}

		if row.MeasurementStatus.Valid {
			md.measurements = append(md.measurements,
				oapi.VerificationMeasurementStatus(row.MeasurementStatus.JobVerificationStatus))
		}
	}

	result := make(map[string]oapi.JobVerificationStatus, len(byJob))
	for jobID, metrics := range byJob {
		jv := oapi.JobVerification{}
		for _, md := range metrics {
			vms := oapi.VerificationMetricStatus{
				Count:            md.count,
				FailureThreshold: md.failureThreshold,
				SuccessThreshold: md.successThreshold,
			}
			for _, ms := range md.measurements {
				vms.Measurements = append(vms.Measurements, oapi.VerificationMeasurement{
					Status: ms,
				})
			}
			jv.Metrics = append(jv.Metrics, vms)
		}
		result[jobID] = jv.Status()
	}

	span.SetAttributes(attribute.Int("jobs_with_verification", len(result)))
	return result, nil
}

func (p *PostgresGetters) GetReleaseByJobID(
	ctx context.Context,
	jobID string,
) (*oapi.Release, error) {
	row, err := p.queries.GetReleaseByJobID(ctx, uuid.MustParse(jobID))
	if err != nil {
		return nil, err
	}
	release := db.ToOapiRelease(row)

	versionRow, err := p.queries.GetDeploymentVersionByID(ctx, row.VersionID)
	if err != nil {
		return nil, err
	}
	release.Version = *db.ToOapiDeploymentVersion(versionRow)

	return release, nil
}
