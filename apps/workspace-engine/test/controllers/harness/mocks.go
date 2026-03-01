package harness

import (
	"context"
	"fmt"
	"sync"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/jobdispatch"
	"workspace-engine/svc/controllers/verification"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// deploymentresourceselectoreval mocks
// ---------------------------------------------------------------------------

// SelectorEvalGetter implements deploymentresourceselectoreval.Getter.
type SelectorEvalGetter struct {
	Deployment     *selectoreval.DeploymentInfo
	Resources      []selectoreval.ResourceInfo
	ReleaseTargets []selectoreval.ReleaseTarget
}

func (g *SelectorEvalGetter) GetDeploymentInfo(_ context.Context, _ uuid.UUID) (*selectoreval.DeploymentInfo, error) {
	return g.Deployment, nil
}

func (g *SelectorEvalGetter) StreamResources(_ context.Context, _ uuid.UUID, _ int, batches chan<- []selectoreval.ResourceInfo) error {
	defer close(batches)
	if len(g.Resources) > 0 {
		batches <- g.Resources
	}
	return nil
}

func (g *SelectorEvalGetter) GetReleaseTargetsForDeployment(_ context.Context, _ uuid.UUID) ([]selectoreval.ReleaseTarget, error) {
	return g.ReleaseTargets, nil
}

// SelectorEvalSetter implements deploymentresourceselectoreval.Setter.
type SelectorEvalSetter struct {
	mu                sync.Mutex
	ComputedResources []uuid.UUID
}

func (s *SelectorEvalSetter) SetComputedDeploymentResources(_ context.Context, _ uuid.UUID, ids []uuid.UUID) error {
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
	mu sync.Mutex

	Scope           *evaluator.EvaluatorScope
	Versions        []*oapi.DeploymentVersion
	Policies        []*oapi.Policy
	ApprovalRecords []*oapi.UserApprovalRecord
	HasRelease      bool
	CurrentRelease  *oapi.Release
	PolicySkips     []*oapi.PolicySkip

	DeploymentVars []oapi.DeploymentVariableWithValues
	ResourceVars   map[string]oapi.ResourceVariable
	RelatedEntity  map[string][]*oapi.EntityRelation

	// ApprovalRecordsFn allows per-version/per-environment logic when set.
	ApprovalRecordsFn func(versionID, environmentID string) []*oapi.UserApprovalRecord

	// PolicySkipsFn allows per-version/per-environment/per-resource logic when set.
	PolicySkipsFn func(versionID, environmentID, resourceID string) []*oapi.PolicySkip
}

func (g *DesiredReleaseGetter) ReleaseTargetExists(_ context.Context, _ *desiredrelease.ReleaseTarget) (bool, error) {
	return true, nil
}

func (g *DesiredReleaseGetter) GetReleaseTargetScope(_ context.Context, _ *desiredrelease.ReleaseTarget) (*evaluator.EvaluatorScope, error) {
	return g.Scope, nil
}

func (g *DesiredReleaseGetter) GetCandidateVersions(_ context.Context, _ uuid.UUID) ([]*oapi.DeploymentVersion, error) {
	return g.Versions, nil
}

func (g *DesiredReleaseGetter) GetPolicies(_ context.Context, _ *desiredrelease.ReleaseTarget) ([]*oapi.Policy, error) {
	return g.Policies, nil
}

func (g *DesiredReleaseGetter) GetApprovalRecords(_ context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	if g.ApprovalRecordsFn != nil {
		return g.ApprovalRecordsFn(versionID, environmentID), nil
	}
	return g.ApprovalRecords, nil
}

func (g *DesiredReleaseGetter) HasCurrentRelease(_ context.Context, _ *desiredrelease.ReleaseTarget) (bool, error) {
	return g.HasRelease, nil
}

func (g *DesiredReleaseGetter) GetCurrentRelease(_ context.Context, _ *desiredrelease.ReleaseTarget) (*oapi.Release, error) {
	return g.CurrentRelease, nil
}

func (g *DesiredReleaseGetter) GetPolicySkips(_ context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error) {
	if g.PolicySkipsFn != nil {
		return g.PolicySkipsFn(versionID, environmentID, resourceID), nil
	}
	return g.PolicySkips, nil
}

func (g *DesiredReleaseGetter) GetDeploymentVariables(_ context.Context, _ string) ([]oapi.DeploymentVariableWithValues, error) {
	return g.DeploymentVars, nil
}

func (g *DesiredReleaseGetter) GetResourceVariables(_ context.Context, _ string) (map[string]oapi.ResourceVariable, error) {
	return g.ResourceVars, nil
}

func (g *DesiredReleaseGetter) GetRelatedEntity(_ context.Context, _, reference string) ([]*oapi.EntityRelation, error) {
	return g.RelatedEntity[reference], nil
}

// DesiredReleaseSetter implements desiredrelease.Setter.
// When JobDispatchQueue is set, it also enqueues a job-dispatch item for
// each release that is set, bridging the desired-release and job-dispatch
// controllers in end-to-end pipeline tests.
type DesiredReleaseSetter struct {
	mu        sync.Mutex
	Releases  []*oapi.Release
	CallCount int

	JobDispatchQueue reconcile.Queue
	WorkspaceID      string
}

func (s *DesiredReleaseSetter) SetDesiredRelease(ctx context.Context, rt *desiredrelease.ReleaseTarget, r *oapi.Release) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.CallCount++
	s.Releases = append(s.Releases, r)

	if s.JobDispatchQueue != nil {
		scopeID := fmt.Sprintf("%s:%s:%s",
			rt.DeploymentID.String(),
			rt.EnvironmentID.String(),
			rt.ResourceID.String(),
		)
		_ = s.JobDispatchQueue.Enqueue(ctx, reconcile.EnqueueParams{
			WorkspaceID: s.WorkspaceID,
			Kind:        KindJobDispatch,
			ScopeType:   "release-target",
			ScopeID:     scopeID,
		})
	}
	return nil
}

// ---------------------------------------------------------------------------
// jobdispatch mocks
// ---------------------------------------------------------------------------

// JobDispatchGetter implements jobdispatch.Getter. It reads releases from
// the DesiredReleaseSetter so the job dispatch controller can see releases
// created by the desired-release controller.
type JobDispatchGetter struct {
	mu sync.Mutex

	ReleaseSetter *DesiredReleaseSetter
	Agents        []oapi.JobAgent

	ExistingJobs         []oapi.Job
	ActiveJobs           []oapi.Job
	VerificationPolicies []oapi.VerificationMetricSpec
}

func (g *JobDispatchGetter) ReleaseTargetExists(_ context.Context, _ *jobdispatch.ReleaseTarget) (bool, error) {
	return true, nil
}

func (g *JobDispatchGetter) GetDesiredRelease(_ context.Context, rt *jobdispatch.ReleaseTarget) (*oapi.Release, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	targetKey := fmt.Sprintf("%s:%s:%s",
		rt.DeploymentID.String(),
		rt.EnvironmentID.String(),
		rt.ResourceID.String(),
	)

	g.ReleaseSetter.mu.Lock()
	defer g.ReleaseSetter.mu.Unlock()

	for i := len(g.ReleaseSetter.Releases) - 1; i >= 0; i-- {
		r := g.ReleaseSetter.Releases[i]
		rKey := fmt.Sprintf("%s:%s:%s",
			r.ReleaseTarget.DeploymentId,
			r.ReleaseTarget.EnvironmentId,
			r.ReleaseTarget.ResourceId,
		)
		if rKey == targetKey {
			return r, nil
		}
	}
	return nil, nil
}

func (g *JobDispatchGetter) GetJobsForRelease(_ context.Context, _ uuid.UUID) ([]oapi.Job, error) {
	return g.ExistingJobs, nil
}

func (g *JobDispatchGetter) GetActiveJobsForTarget(_ context.Context, _ *jobdispatch.ReleaseTarget) ([]oapi.Job, error) {
	return g.ActiveJobs, nil
}

func (g *JobDispatchGetter) GetJobAgentsForDeployment(_ context.Context, _ uuid.UUID) ([]oapi.JobAgent, error) {
	return g.Agents, nil
}

func (g *JobDispatchGetter) GetVerificationPolicies(_ context.Context, _ *jobdispatch.ReleaseTarget) ([]oapi.VerificationMetricSpec, error) {
	return g.VerificationPolicies, nil
}

// JobDispatchSetter implements jobdispatch.Setter for testing.
type JobDispatchSetter struct {
	mu                sync.Mutex
	Jobs              []*oapi.Job
	VerificationSpecs [][]oapi.VerificationMetricSpec
}

func (s *JobDispatchSetter) UpdateJob(_ context.Context, _ string, _ oapi.JobStatus, _ string, _ map[string]string) error {
	return nil
}

func (s *JobDispatchSetter) CreateJobWithVerification(_ context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Jobs = append(s.Jobs, job)
	s.VerificationSpecs = append(s.VerificationSpecs, specs)
	return nil
}

// ---------------------------------------------------------------------------
// verification mocks
// ---------------------------------------------------------------------------

// VerificationGetter implements verification.Getter.
type VerificationGetter struct {
	mu sync.Mutex

	Verifications map[string]*oapi.JobVerification
	Jobs          map[string]*oapi.Job
	ProviderCtx   *provider.ProviderContext
	ReleaseTarget *verification.ReleaseTarget
}

func (g *VerificationGetter) GetVerification(_ context.Context, id string) (*oapi.JobVerification, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	v, ok := g.Verifications[id]
	if !ok {
		return nil, nil
	}
	return v, nil
}

func (g *VerificationGetter) GetJob(_ context.Context, jobID string) (*oapi.Job, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	j, ok := g.Jobs[jobID]
	if !ok {
		return nil, fmt.Errorf("job %s not found", jobID)
	}
	return j, nil
}

func (g *VerificationGetter) GetProviderContext(_ context.Context, _ string) (*provider.ProviderContext, error) {
	return g.ProviderCtx, nil
}

func (g *VerificationGetter) GetReleaseTarget(_ context.Context, _ string) (*verification.ReleaseTarget, error) {
	return g.ReleaseTarget, nil
}

// UpdateVerification replaces the stored verification, simulating what the
// DB would do after RecordMeasurement.
func (g *VerificationGetter) UpdateVerification(v *oapi.JobVerification) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.Verifications[v.Id] = v
}

// VerificationSetter implements verification.Setter.
type VerificationSetter struct {
	mu sync.Mutex

	RecordedMeasurements []RecordedMeasurement
	Messages             map[string]string
	EnqueuedTargets      []*verification.ReleaseTarget

	Getter *VerificationGetter
}

// RecordedMeasurement captures a single RecordMeasurement call.
type RecordedMeasurement struct {
	VerificationID string
	MetricIndex    int
	Measurement    oapi.VerificationMeasurement
}

func (s *VerificationSetter) RecordMeasurement(_ context.Context, verificationID string, metricIndex int, measurement oapi.VerificationMeasurement) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RecordedMeasurements = append(s.RecordedMeasurements, RecordedMeasurement{
		VerificationID: verificationID,
		MetricIndex:    metricIndex,
		Measurement:    measurement,
	})

	if s.Getter != nil {
		s.Getter.mu.Lock()
		if v, ok := s.Getter.Verifications[verificationID]; ok {
			v.Metrics[metricIndex].Measurements = append(
				v.Metrics[metricIndex].Measurements, measurement,
			)
		}
		s.Getter.mu.Unlock()
	}
	return nil
}

func (s *VerificationSetter) UpdateVerificationMessage(_ context.Context, verificationID, message string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Messages == nil {
		s.Messages = make(map[string]string)
	}
	s.Messages[verificationID] = message
	return nil
}

func (s *VerificationSetter) EnqueueDesiredRelease(_ context.Context, _ string, rt *verification.ReleaseTarget) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.EnqueuedTargets = append(s.EnqueuedTargets, rt)
	return nil
}
