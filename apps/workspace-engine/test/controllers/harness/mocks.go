package harness

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/policies/match"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/resources"
	"workspace-engine/pkg/workspace/relationships/eval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/jobdispatch"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"
)

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

var _ desiredrelease.Getter = (*DesiredReleaseGetter)(nil)

// ---------------------------------------------------------------------------
// deploymentresourceselectoreval mocks
// ---------------------------------------------------------------------------

// SelectorEvalGetter implements deploymentresourceselectoreval.Getter.
type SelectorEvalGetter struct {
	Deployment     *selectoreval.DeploymentInfo
	Resources      []*oapi.Resource
	ReleaseTargets []selectoreval.ReleaseTarget
}

func (g *SelectorEvalGetter) GetDeploymentInfo(
	_ context.Context,
	_ uuid.UUID,
) (*selectoreval.DeploymentInfo, error) {
	return g.Deployment, nil
}

func (g *SelectorEvalGetter) GetResources(
	_ context.Context,
	_ string,
	opts resources.GetResourcesOptions,
) ([]*oapi.Resource, error) {
	if opts.CEL == "" {
		return g.Resources, nil
	}
	program, err := celEnv.Compile(opts.CEL)
	if err != nil {
		return nil, fmt.Errorf("compile CEL: %w", err)
	}
	var matched []*oapi.Resource
	for _, r := range g.Resources {
		resourceMap, err := celutil.EntityToMap(r)
		if err != nil {
			continue
		}
		ok, err := celutil.EvalBool(program, map[string]any{"resource": resourceMap})
		if err != nil {
			continue
		}
		if ok {
			matched = append(matched, r)
		}
	}
	return matched, nil
}

func (g *SelectorEvalGetter) GetReleaseTargetsForDeployment(
	_ context.Context,
	_ uuid.UUID,
) ([]selectoreval.ReleaseTarget, error) {
	return g.ReleaseTargets, nil
}

// SelectorEvalSetter implements deploymentresourceselectoreval.Setter.
type SelectorEvalSetter struct {
	mu                sync.Mutex
	ComputedResources []uuid.UUID
}

func (s *SelectorEvalSetter) SetComputedDeploymentResources(
	_ context.Context,
	_ uuid.UUID,
	ids []uuid.UUID,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ComputedResources = ids
	return nil
}

// ---------------------------------------------------------------------------
// desiredrelease mocks
// ---------------------------------------------------------------------------

// DesiredReleaseGetter implements desiredrelease.Getter.
type DesiredReleaseGetter struct {
	Scope           *evaluator.EvaluatorScope
	Versions        []*oapi.DeploymentVersion
	Policies        []*oapi.Policy
	ApprovalRecords []*oapi.UserApprovalRecord
	HasRelease      bool
	CurrentRelease  *oapi.Release
	PolicySkips     []*oapi.PolicySkip

	DeploymentVars    []oapi.DeploymentVariableWithValues
	ResourceVars      map[string]oapi.ResourceVariable
	RelationshipRules []eval.Rule
	Candidates        map[string][]eval.EntityData

	ReleaseTargetsList          []*oapi.ReleaseTarget
	ReleaseTargetsByEnvironment map[string][]*oapi.ReleaseTarget
	ReleaseTargetsByDeployment  map[string][]*oapi.ReleaseTarget
	ReleaseTargetsByResource    map[string][]*oapi.ReleaseTarget
	AllReleaseTargetsList       []*oapi.ReleaseTarget
	JobsByReleaseTarget         map[string]map[string]*oapi.Job
	LatestCompletedJobs         map[string]*oapi.Job
	JobVerificationStatuses     map[string]oapi.JobVerificationStatus
	Deployments                 map[string]*oapi.Deployment
	Environments                map[string]*oapi.Environment
	Resources                   map[string]*oapi.Resource
	Releases                    map[string]*oapi.Release
	SystemIDsByEnvironment      map[string][]string
	AllPoliciesMap              map[string]*oapi.Policy

	// ApprovalRecordsFn allows per-version/per-environment logic when set.
	ApprovalRecordsFn func(versionID, environmentID string) []*oapi.UserApprovalRecord

	// PolicySkipsFn allows per-version/per-environment/per-resource logic when set.
	PolicySkipsFn func(versionID, environmentID, resourceID string) []*oapi.PolicySkip

	// HasCurrentReleaseFn allows per-release-target logic when set.
	HasCurrentReleaseFn func(rt *oapi.ReleaseTarget) bool
}

func (g *DesiredReleaseGetter) ReleaseTargetExists(
	_ context.Context,
	_ *desiredrelease.ReleaseTarget,
) (bool, error) {
	return true, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetScope(
	_ context.Context,
	_ *desiredrelease.ReleaseTarget,
) (*evaluator.EvaluatorScope, error) {
	return g.Scope, nil
}

func (g *DesiredReleaseGetter) GetCandidateVersions(
	_ context.Context,
	_ uuid.UUID,
) ([]*oapi.DeploymentVersion, error) {
	return g.Versions, nil
}

func (g *DesiredReleaseGetter) GetPoliciesForReleaseTarget(
	ctx context.Context,
	_ *oapi.ReleaseTarget,
) ([]*oapi.Policy, error) {
	return match.Filter(ctx, g.Policies, g.Scope.ToTarget()), nil
}

func (g *DesiredReleaseGetter) GetApprovalRecords(
	_ context.Context,
	versionID, environmentID string,
) ([]*oapi.UserApprovalRecord, error) {
	if g.ApprovalRecordsFn != nil {
		return g.ApprovalRecordsFn(versionID, environmentID), nil
	}
	return g.ApprovalRecords, nil
}

func (g *DesiredReleaseGetter) HasCurrentRelease(
	_ context.Context,
	rt *oapi.ReleaseTarget,
) (bool, error) {
	if g.HasCurrentReleaseFn != nil {
		return g.HasCurrentReleaseFn(rt), nil
	}
	return g.HasRelease, nil
}

func (g *DesiredReleaseGetter) GetCurrentRelease(
	_ context.Context,
	_ *desiredrelease.ReleaseTarget,
) (*oapi.Release, error) {
	return g.CurrentRelease, nil
}

func (g *DesiredReleaseGetter) GetPolicySkips(
	_ context.Context,
	versionID, environmentID, resourceID string,
) ([]*oapi.PolicySkip, error) {
	if g.PolicySkipsFn != nil {
		return g.PolicySkipsFn(versionID, environmentID, resourceID), nil
	}
	return g.PolicySkips, nil
}

func (g *DesiredReleaseGetter) GetDeploymentVariables(
	_ context.Context,
	_ string,
) ([]oapi.DeploymentVariableWithValues, error) {
	return g.DeploymentVars, nil
}

func (g *DesiredReleaseGetter) GetResourceVariables(
	_ context.Context,
	_ string,
) (map[string]oapi.ResourceVariable, error) {
	return g.ResourceVars, nil
}

func (g *DesiredReleaseGetter) GetRelationshipRules(
	_ context.Context,
	_ uuid.UUID,
) ([]eval.Rule, error) {
	return g.RelationshipRules, nil
}

func (g *DesiredReleaseGetter) LoadCandidates(
	_ context.Context,
	_ uuid.UUID,
	entityType string,
) ([]eval.EntityData, error) {
	if g.Candidates != nil {
		return g.Candidates[entityType], nil
	}
	return nil, nil
}

func (g *DesiredReleaseGetter) GetEntityByID(
	_ context.Context,
	entityID uuid.UUID,
	entityType string,
) (*eval.EntityData, error) {
	if g.Candidates != nil {
		for i := range g.Candidates[entityType] {
			if g.Candidates[entityType][i].ID == entityID {
				return &g.Candidates[entityType][i], nil
			}
		}
	}
	return nil, fmt.Errorf("%s with id %s not found", entityType, entityID)
}

func (g *DesiredReleaseGetter) GetAllDeployments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Deployment, error) {
	return g.Deployments, nil
}

func (g *DesiredReleaseGetter) GetDeployment(
	_ context.Context,
	id string,
) (*oapi.Deployment, error) {
	if g.Deployments != nil {
		return g.Deployments[id], nil
	}
	return nil, nil
}

func (g *DesiredReleaseGetter) GetAllEnvironments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Environment, error) {
	return g.Environments, nil
}

func (g *DesiredReleaseGetter) GetEnvironment(
	_ context.Context,
	id string,
) (*oapi.Environment, error) {
	if g.Environments != nil {
		return g.Environments[id], nil
	}
	return nil, nil
}
func (g *DesiredReleaseGetter) GetResource(_ context.Context, id string) (*oapi.Resource, error) {
	if g.Resources != nil {
		return g.Resources[id], nil
	}
	return nil, nil
}
func (g *DesiredReleaseGetter) GetRelease(_ context.Context, id string) (*oapi.Release, error) {
	if g.Releases != nil {
		return g.Releases[id], nil
	}
	return nil, nil
}

func (g *DesiredReleaseGetter) GetAllPolicies(
	_ context.Context,
	_ string,
) (map[string]*oapi.Policy, error) {
	return g.AllPoliciesMap, nil
}
func (g *DesiredReleaseGetter) GetSystemIDsForEnvironment(envID string) []string {
	if g.SystemIDsByEnvironment != nil {
		return g.SystemIDsByEnvironment[envID]
	}
	return nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetsForEnvironment(
	_ context.Context,
	envID string,
) ([]*oapi.ReleaseTarget, error) {
	if g.ReleaseTargetsByEnvironment != nil {
		return g.ReleaseTargetsByEnvironment[envID], nil
	}
	return nil, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetsForDeployment(
	_ context.Context,
	depID string,
) ([]*oapi.ReleaseTarget, error) {
	if g.ReleaseTargetsByDeployment != nil {
		return g.ReleaseTargetsByDeployment[depID], nil
	}
	var results []*oapi.ReleaseTarget
	for _, rt := range g.ReleaseTargetsList {
		if rt.DeploymentId == depID {
			results = append(results, rt)
		}
	}
	return results, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetsForDeploymentAndEnvironment(
	_ context.Context,
	depID, envID string,
) ([]oapi.ReleaseTarget, error) {
	var source []*oapi.ReleaseTarget
	switch {
	case g.ReleaseTargetsByDeployment != nil:
		source = g.ReleaseTargetsByDeployment[depID]
	case g.ReleaseTargetsByEnvironment != nil:
		source = g.ReleaseTargetsByEnvironment[envID]
	default:
		source = g.ReleaseTargetsList
	}
	var results []oapi.ReleaseTarget
	for _, rt := range source {
		if rt.DeploymentId == depID && rt.EnvironmentId == envID {
			results = append(results, *rt)
		}
	}
	return results, nil
}

func (g *DesiredReleaseGetter) GetJobsForReleaseTarget(
	_ context.Context,
	rt *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	if g.JobsByReleaseTarget != nil {
		key := rt.DeploymentId + ":" + rt.EnvironmentId + ":" + rt.ResourceId
		return g.JobsByReleaseTarget[key]
	}
	return nil
}
func (g *DesiredReleaseGetter) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	if g.JobVerificationStatuses != nil {
		if s, ok := g.JobVerificationStatuses[jobID]; ok {
			return s
		}
	}
	return oapi.JobVerificationStatusCancelled
}
func (g *DesiredReleaseGetter) NewVersionCooldownEvaluator(_ *oapi.PolicyRule) evaluator.Evaluator {
	return nil
}

func (g *DesiredReleaseGetter) GetAllReleaseTargets(
	_ context.Context,
	_ string,
) ([]*oapi.ReleaseTarget, error) {
	return g.AllReleaseTargetsList, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetsForResource(
	_ context.Context,
	resourceID string,
) []*oapi.ReleaseTarget {
	if g.ReleaseTargetsByResource != nil {
		return g.ReleaseTargetsByResource[resourceID]
	}
	return nil
}

func (g *DesiredReleaseGetter) GetLatestCompletedJobForReleaseTarget(
	rt *oapi.ReleaseTarget,
) *oapi.Job {
	if g.LatestCompletedJobs != nil {
		key := rt.DeploymentId + ":" + rt.EnvironmentId + ":" + rt.ResourceId
		return g.LatestCompletedJobs[key]
	}
	return nil
}

func (g *DesiredReleaseGetter) GetReleaseByJobID(
	_ context.Context,
	jobID string,
) (*oapi.Release, error) {
	for _, jobs := range g.JobsByReleaseTarget {
		if job, ok := jobs[jobID]; ok {
			if release, ok := g.Releases[job.ReleaseId]; ok {
				return release, nil
			}
			return nil, fmt.Errorf("release not found for job %s", jobID)
		}
	}
	return nil, fmt.Errorf("job %s not found", jobID)
}

type eligibilityCall struct {
	WorkspaceID string
	RT          *desiredrelease.ReleaseTarget
}

// DesiredReleaseSetter implements desiredrelease.Setter.
// When JobDispatchQueue is set, it also creates a pending job and enqueues
// a job-dispatch item (keyed by job ID) for each release that is set,
// bridging the desired-release and job-dispatch controllers in pipeline tests.
type DesiredReleaseSetter struct {
	mu        sync.Mutex
	Releases  []*oapi.Release
	CallCount int

	JobDispatchQueue  reconcile.Queue
	JobDispatchGetter *JobDispatchGetter
	WorkspaceID       string
	Agents            []oapi.JobAgent

	eligibilityCalls []eligibilityCall
}

func (s *DesiredReleaseSetter) UpsertRuleEvaluations(
	_ context.Context,
	_ []policies.RuleEvaluationParams,
) error {
	return nil
}

func (s *DesiredReleaseSetter) SetDesiredRelease(
	ctx context.Context,
	_ *desiredrelease.ReleaseTarget,
	r *oapi.Release,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.CallCount++
	if r == nil {
		return nil
	}
	s.Releases = append(s.Releases, r)

	if s.JobDispatchQueue != nil && len(s.Agents) > 0 {
		for _, agent := range s.Agents {
			job := &oapi.Job{
				Id:             uuid.New().String(),
				ReleaseId:      r.Id.String(),
				JobAgentId:     agent.Id,
				JobAgentConfig: agent.Config,
				Status:         oapi.JobStatusPending,
				Metadata:       map[string]string{},
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}

			if s.JobDispatchGetter != nil {
				s.JobDispatchGetter.mu.Lock()
				if s.JobDispatchGetter.Jobs == nil {
					s.JobDispatchGetter.Jobs = make(map[string]*oapi.Job)
				}
				s.JobDispatchGetter.Jobs[job.Id] = job
				s.JobDispatchGetter.mu.Unlock()
			}

			_ = s.JobDispatchQueue.Enqueue(ctx, reconcile.EnqueueParams{
				WorkspaceID: s.WorkspaceID,
				Kind:        KindJobDispatch,
				ScopeType:   "job",
				ScopeID:     job.Id,
			})
		}
	}
	return nil
}

func (s *DesiredReleaseSetter) EnqueueJobEligibility(
	ctx context.Context,
	workspaceID string,
	rt *desiredrelease.ReleaseTarget,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.eligibilityCalls = append(
		s.eligibilityCalls,
		eligibilityCall{WorkspaceID: workspaceID, RT: rt},
	)
	return nil
}

// ---------------------------------------------------------------------------
// jobdispatch mocks
// ---------------------------------------------------------------------------

type noopDispatcher struct{}

func (d *noopDispatcher) Dispatch(_ context.Context, _ *oapi.Job) error { return nil }

// JobDispatchGetter implements jobdispatch.Getter.
type JobDispatchGetter struct {
	mu sync.Mutex

	ReleaseSetter *DesiredReleaseSetter
	Agents        []oapi.JobAgent
	Deployment    *oapi.Deployment
	Jobs          map[string]*oapi.Job

	VerificationPolicies []oapi.VerificationMetricSpec
}

func (g *JobDispatchGetter) GetJob(_ context.Context, jobID uuid.UUID) (*oapi.Job, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.Jobs != nil {
		if j, ok := g.Jobs[jobID.String()]; ok {
			return j, nil
		}
	}
	return nil, fmt.Errorf("job %s not found", jobID)
}

func (g *JobDispatchGetter) GetRelease(
	_ context.Context,
	releaseID uuid.UUID,
) (*oapi.Release, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.ReleaseSetter.mu.Lock()
	defer g.ReleaseSetter.mu.Unlock()

	for _, r := range g.ReleaseSetter.Releases {
		if r.Id.String() == releaseID.String() {
			return r, nil
		}
	}
	return nil, fmt.Errorf("release %s not found", releaseID)
}

func (g *JobDispatchGetter) GetDeployment(
	_ context.Context,
	_ uuid.UUID,
) (*oapi.Deployment, error) {
	return g.Deployment, nil
}

func (g *JobDispatchGetter) GetJobAgent(
	_ context.Context,
	jobAgentID uuid.UUID,
) (*oapi.JobAgent, error) {
	for i := range g.Agents {
		if g.Agents[i].Id == jobAgentID.String() {
			return &g.Agents[i], nil
		}
	}
	return nil, fmt.Errorf("job agent %s not found", jobAgentID)
}

func (g *JobDispatchGetter) GetVerificationPolicies(
	_ context.Context,
	_ *jobdispatch.ReleaseTarget,
) ([]oapi.VerificationMetricSpec, error) {
	return g.VerificationPolicies, nil
}

// JobDispatchSetter implements jobdispatch.Setter for testing.
type JobDispatchSetter struct {
	mu                sync.Mutex
	Jobs              []*oapi.Job
	VerificationSpecs [][]oapi.VerificationMetricSpec
}

func (s *JobDispatchSetter) UpdateJob(
	_ context.Context,
	_ string,
	_ oapi.JobStatus,
	_ string,
	_ map[string]string,
) error {
	return nil
}

func (s *JobDispatchSetter) CreateVerifications(
	_ context.Context,
	job *oapi.Job,
	specs []oapi.VerificationMetricSpec,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Jobs = append(s.Jobs, job)
	s.VerificationSpecs = append(s.VerificationSpecs, specs)
	return nil
}

// ---------------------------------------------------------------------------
// verification mocks
// ---------------------------------------------------------------------------

// VerificationGetter implements verificationmetric.Getter.
type VerificationGetter struct {
	mu sync.Mutex

	Metrics     map[string]*metrics.VerificationMetric
	ProviderCtx *provider.ProviderContext
}

func (g *VerificationGetter) GetVerificationMetric(
	_ context.Context,
	id string,
) (*metrics.VerificationMetric, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.Metrics[id], nil
}

func (g *VerificationGetter) GetProviderContext(
	_ context.Context,
	_ string,
) (*provider.ProviderContext, error) {
	return g.ProviderCtx, nil
}

// VerificationSetter implements verificationmetric.Setter.
type VerificationSetter struct {
	mu sync.Mutex

	RecordedMeasurements []RecordedMeasurement
	Completed            map[string]metrics.VerificationStatus

	Getter *VerificationGetter
}

// RecordedMeasurement captures a single RecordMeasurement call.
type RecordedMeasurement struct {
	MetricID    string
	Measurement metrics.Measurement
}

func (s *VerificationSetter) RecordMeasurement(
	_ context.Context,
	metricID string,
	measurement metrics.Measurement,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RecordedMeasurements = append(s.RecordedMeasurements, RecordedMeasurement{
		MetricID:    metricID,
		Measurement: measurement,
	})

	if s.Getter != nil {
		s.Getter.mu.Lock()
		if m, ok := s.Getter.Metrics[metricID]; ok {
			m.Measurements = append(m.Measurements, measurement)
		}
		s.Getter.mu.Unlock()
	}
	return nil
}

func (s *VerificationSetter) CompleteMetric(
	_ context.Context,
	metricID string,
	status metrics.VerificationStatus,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Completed == nil {
		s.Completed = make(map[string]metrics.VerificationStatus)
	}
	s.Completed[metricID] = status
	return nil
}
