package deploymentdependency

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func generateMatchAllSelector() *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: "true",
	})
	return selector
}

func generateEnvironment(ctx context.Context, systemID string, store *store.Store) *oapi.Environment {
	environment := &oapi.Environment{
		SystemId:         systemID,
		Id:               uuid.New().String(),
		ResourceSelector: generateMatchAllSelector(),
	}
	_ = store.Environments.Upsert(ctx, environment)
	return environment
}

func generateDeployment(ctx context.Context, systemID string, store *store.Store) *oapi.Deployment {
	deployment := &oapi.Deployment{
		SystemId:         systemID,
		Id:               uuid.New().String(),
		ResourceSelector: generateMatchAllSelector(),
	}
	_ = store.Deployments.Upsert(ctx, deployment)
	return deployment
}

func generateResource(ctx context.Context, store *store.Store) *oapi.Resource {
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource",
		Kind:       "service",
	}
	_, _ = store.Resources.Upsert(ctx, resource)
	return resource
}

func generateReleaseTarget(ctx context.Context, resource *oapi.Resource, environment *oapi.Environment, deployment *oapi.Deployment, store *store.Store) *oapi.ReleaseTarget {
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}
	_ = store.ReleaseTargets.Upsert(ctx, releaseTarget)
	return releaseTarget
}

func generateDependencyRule(cel string) *oapi.PolicyRule {
	selector := oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: cel,
	})
	return &oapi.PolicyRule{
		Id: uuid.New().String(),
		DeploymentDependency: &oapi.DeploymentDependencyRule{
			DependsOnDeploymentSelector: selector,
		},
	}
}

func generateReleaseAndJob(ctx context.Context, releaseTarget *oapi.ReleaseTarget, jobStatus oapi.JobStatus, st *store.Store) *oapi.Job {
	now := time.Now()
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			Tag:          "v1.0.0",
			DeploymentId: releaseTarget.DeploymentId,
			Status:       oapi.DeploymentVersionStatusReady,
			CreatedAt:    now,
		},
	}

	_ = st.Releases.Upsert(ctx, release)

	var completedAt *time.Time
	if jobStatus != oapi.JobStatusPending && jobStatus != oapi.JobStatusInProgress {
		completedAt = &now
	}

	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      jobStatus,
		CreatedAt:   now,
		CompletedAt: completedAt,
	}
	st.Jobs.Upsert(ctx, job)

	return job
}

func TestDeploymentDependencyEvaluator_UnsatisfiedDependencyFails(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(st, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget})
	assert.False(t, result.Allowed, "expected denied when dependency is not satisfied")
}

func TestDeploymentDependencyEvaluator_SatisfiedDependencyPasses(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	releaseTarget1 := generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusSuccessful, st)

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(st, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget2})

	assert.True(t, result.Allowed, "expected allowed when dependency is satisfied")
}

func TestDeploymentDependencyEvaluator_MixedSatisfactionsFails(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	system3ID := "system-3"
	environment3 := generateEnvironment(ctx, system3ID, st)
	deployment3 := generateDeployment(ctx, system3ID, st)

	resource := generateResource(ctx, st)

	releaseTarget1 := generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	generateReleaseTarget(ctx, resource, environment2, deployment2, st)
	releaseTarget3 := generateReleaseTarget(ctx, resource, environment3, deployment3, st)

	generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusSuccessful, st)

	cel := fmt.Sprintf("deployment.id != '%s'", deployment3.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(st, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget3})
	assert.False(t, result.Allowed, "expected denied when some upstream release targets are not successful")
}

func TestDeploymentDependencyEvaluator_FailedJobsFails(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	system3ID := "system-3"
	environment3 := generateEnvironment(ctx, system3ID, st)
	deployment3 := generateDeployment(ctx, system3ID, st)

	resource := generateResource(ctx, st)

	releaseTarget1 := generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)
	releaseTarget3 := generateReleaseTarget(ctx, resource, environment3, deployment3, st)

	generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusSuccessful, st)
	generateReleaseAndJob(ctx, releaseTarget2, oapi.JobStatusFailure, st)

	cel := fmt.Sprintf("deployment.id != '%s'", deployment3.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(st, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget3})
	assert.False(t, result.Allowed, "expected denied when some upstream release targets are not successful")
}

func TestDeploymentDependencyEvaluator_FailsIfLatestJobIsNotSuccessful(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	releaseTarget1 := generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	job1 := generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusSuccessful, st)
	generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusFailure, st)

	now := time.Now()
	oneHourAgo := now.Add(-1 * time.Hour)
	job1.CompletedAt = &oneHourAgo

	st.Jobs.Upsert(ctx, job1)

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(st, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget2})
	assert.False(t, result.Allowed, "expected denied when latest job is not successful")
}

func TestDeploymentDependencyEvaluator_PassesIfLatestJobIsProgressingAndOtherJobsAreSuccessful(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	releaseTarget1 := generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	job1 := generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusSuccessful, st)
	generateReleaseAndJob(ctx, releaseTarget1, oapi.JobStatusInProgress, st)

	now := time.Now()
	oneHourAgo := now.Add(-1 * time.Hour)
	job1.CompletedAt = &oneHourAgo

	st.Jobs.Upsert(ctx, job1)

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(st, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget2})
	assert.True(t, result.Allowed, "expected allowed when latest job is progressing and other jobs are successful")
}

func TestDeploymentDependencyEvaluator_NoMatchingDeploymentsFails(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	environment1 := generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	generateReleaseTarget(ctx, resource, environment1, deployment1, st)
	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	cel := "deployment.id == 'non-existing-deployment'"
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(st, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget2})
	assert.False(t, result.Allowed, "expected denied when no matching deployments are found")
}

func TestDeploymentDependencyEvaluator_NotEnoughUpstreamReleaseTargetsFails(t *testing.T) {
	ctx := context.Background()

	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	system1ID := "system-1"
	generateEnvironment(ctx, system1ID, st)
	deployment1 := generateDeployment(ctx, system1ID, st)

	system2ID := "system-2"
	environment2 := generateEnvironment(ctx, system2ID, st)
	deployment2 := generateDeployment(ctx, system2ID, st)

	resource := generateResource(ctx, st)

	releaseTarget2 := generateReleaseTarget(ctx, resource, environment2, deployment2, st)

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(st, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{ReleaseTarget: releaseTarget2})
	assert.False(t, result.Allowed, "expected denied when not enough upstream release targets are found")
}
