package policymanager

import (
	"context"
	"errors"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/skipdeployed"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles policy evaluation for release decisions.
type Manager struct {
	store                 *store.Store

	defaultVersionRuleEvaluators []results.VersionRuleEvaluator
	defaultReleaseRuleEvaluators []results.ReleaseRuleEvaluator
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store: store,
		defaultVersionRuleEvaluators: []results.VersionRuleEvaluator{
			deployableversions.NewDeployableVersionStatusEvaluator(store),
		},
		defaultReleaseRuleEvaluators: []results.ReleaseRuleEvaluator{
			skipdeployed.NewSkipDeployedEvaluator(store),
		},
	}
}

func (m *Manager) EvaluateRelease(
	ctx context.Context,
	release *oapi.Release,
) (*DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "EvaluateRelease",
		trace.WithAttributes(
			attribute.String("deployment.id", release.ReleaseTarget.DeploymentId),
			attribute.String("environment.id", release.ReleaseTarget.EnvironmentId),
			attribute.String("resource.id", release.ReleaseTarget.ResourceId),
			attribute.String("version.id", release.Version.Id),
			attribute.String("version.tag", release.Version.Tag),
		))
	defer span.End()

	startTime := time.Now()
	decision := &DeployDecision{
		PolicyResults: make([]*results.PolicyEvaluationResult, 0, len(m.defaultReleaseRuleEvaluators)),
		EvaluatedAt:   startTime,
	}
	for _, evaluator := range m.defaultReleaseRuleEvaluators {
		policyResult := results.NewPolicyEvaluation()
		ruleResult, err := evaluator.Evaluate(ctx, &release.ReleaseTarget, release)
		if err != nil {
			return nil, err
		}

		policyResult.AddRuleResult(ruleResult)
		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}
	return decision, nil
}

// Evaluate evaluates all applicable policies for a deployment and returns a comprehensive decision
func (m *Manager) EvaluateVersion(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) (*DeployDecision, error) {
	startTime := time.Now()
	ctx, span := tracer.Start(ctx, "PolicyManager.EvaluateVersion")
	defer span.End()

	decision := &DeployDecision{
		PolicyResults: []*results.PolicyEvaluationResult{},
		EvaluatedAt:   startTime,
	}

	// Run default version rule evaluators (e.g., version status checks)
	for _, evaluator := range m.defaultVersionRuleEvaluators {
		policyResult := results.NewPolicyEvaluation()
		ruleResult, err := evaluator.Evaluate(ctx, releaseTarget, version)
		if err != nil {
			return nil, err
		}

		policyResult.AddRuleResult(ruleResult)
		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	// Get all policies that apply to this release target
	applicablePolicies, err := m.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to get applicable policies")
		return nil, err
	}

	// Fast path: no policies = allowed
	if len(applicablePolicies) == 0 {
		return decision, nil
	}

	// Evaluate each policy
	for _, policy := range applicablePolicies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))

		// Evaluate each rule in the policy
		for _, rule := range policy.Rules {
			results, err := m.evaluateSingleVersionRule(ctx, &rule, version, releaseTarget)
			if err != nil {
				return nil, err
			}
			if results == nil {
				continue
			}
			policyResult.AddRuleResult(results)
		}

		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	return decision, nil
}

func (m *Manager) evaluateSingleVersionRule(
    ctx context.Context,
    rule *oapi.PolicyRule,
    version *oapi.DeploymentVersion,
    releaseTarget *oapi.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	evaluator, err := m.createVersionEvaulatorForRule(ctx, rule, version, releaseTarget)
	if err != nil {
		if errors.Is(err, ErrUnknownVersionEvaluatorType) {
			return nil, nil
		}
		return nil, err
	}
	return evaluator.Evaluate(ctx, releaseTarget, version)
}

var ErrUnknownVersionEvaluatorType = fmt.Errorf("unknown version evaluator type")

// evaluateRule evaluates a single policy rule using direct dispatch.
func (m *Manager) createVersionEvaulatorForRule(
	_ context.Context,
	rule *oapi.PolicyRule,
	_ *oapi.DeploymentVersion,
	_ *oapi.ReleaseTarget,
) (results.VersionRuleEvaluator, error) {
	// Direct switch on rule type - compiler optimizes this to a jump table
	switch {
	case rule.AnyApproval != nil:
		anyApprovalRule := rule.AnyApproval
		return approval.NewAnyApprovalEvaluator(m.store, anyApprovalRule), nil
	default:
		return nil, ErrUnknownVersionEvaluatorType
	}
}
