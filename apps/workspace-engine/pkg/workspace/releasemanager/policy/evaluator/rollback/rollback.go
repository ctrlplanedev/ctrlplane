package rollback

import (
	"context"
	"slices"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

type RollbackEvaluator struct {
	store  *store.Store
	ruleId string
	rule   *oapi.RollbackRule
}

func NewEvaluator(store *store.Store, rule *oapi.PolicyRule) evaluator.Evaluator {
	if rule == nil || rule.Rollback == nil || store == nil {
		return nil
	}
	return evaluator.WithMemoization(&RollbackEvaluator{store: store, ruleId: rule.Id, rule: rule.Rollback})
}

func (e *RollbackEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeReleaseTarget
}

func (e *RollbackEvaluator) RuleType() string {
	return evaluator.RuleTypeRollback
}

func (e *RollbackEvaluator) RuleId() string {
	return e.ruleId
}

func (e *RollbackEvaluator) Complexity() int {
	return 4
}

func (e *RollbackEvaluator) getLatestJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	jobs := e.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
	jobsSlice := make([]*oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		jobsSlice = append(jobsSlice, job)
	}
	if len(jobsSlice) == 0 {
		return nil
	}
	sort.Slice(jobsSlice, func(i, j int) bool {
		return jobsSlice[i].CreatedAt.After(jobsSlice[j].CreatedAt)
	})
	return jobsSlice[0]
}

func (e *RollbackEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	releaseTarget := scope.ReleaseTarget()
	latestJob := e.getLatestJobForReleaseTarget(releaseTarget)
	if latestJob == nil {
		return results.NewAllowedResult("No jobs found for release target")
	}

	jobStatus := latestJob.Status
	if e.rule.OnJobStatuses != nil && slices.Contains(*e.rule.OnJobStatuses, jobStatus) {
		return results.NewDeniedResult("Job status is in rollback statuses").
			WithDetail("job", latestJob)
	}

	if e.rule.OnVerificationFailure == nil || !*e.rule.OnVerificationFailure {
		return results.NewAllowedResult("Job status is not in rollback statuses and on verification failure is not enabled").WithDetail("job", latestJob)
	}

	verifications := e.store.JobVerifications.GetByJobId(latestJob.Id)

	for _, verification := range verifications {
		verificationStatus := verification.Status()
		if verificationStatus == oapi.JobVerificationStatusFailed {
			return results.NewDeniedResult("Verification failed").
				WithDetail("verification", verification).
				WithDetail("job", latestJob)
		}
	}

	return results.NewAllowedResult("No verification failures found").WithDetail("job", latestJob)
}
