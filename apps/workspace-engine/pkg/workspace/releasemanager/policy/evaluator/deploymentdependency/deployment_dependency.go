package deploymentdependency

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	cel "workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
)

var tracer = otel.Tracer("DeploymentDependencyEvaluator")

type DeploymentDependencyEvaluator struct {
	getters Getters
	ruleId  string
	rule    *oapi.DeploymentDependencyRule
}

func NewEvaluator(getters Getters, dependencyRule *oapi.PolicyRule) evaluator.Evaluator {
	if dependencyRule == nil || dependencyRule.DeploymentDependency == nil || getters == nil {
		return nil
	}

	return evaluator.WithMemoization(&DeploymentDependencyEvaluator{
		getters: getters,
		ruleId:  dependencyRule.Id,
		rule:    dependencyRule.DeploymentDependency,
	})
}

func (e *DeploymentDependencyEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeReleaseTarget
}

func (e *DeploymentDependencyEvaluator) RuleType() string {
	return "deploymentDependency"
}

func (e *DeploymentDependencyEvaluator) RuleId() string {
	return e.ruleId
}

func (e *DeploymentDependencyEvaluator) Complexity() int {
	return 3
}

func (e *DeploymentDependencyEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "DeploymentDependencyEvaluator.Evaluate")
	defer span.End()

	dependsOn := e.rule.DependsOn
	span.SetAttributes(
		attribute.String("deployment.id", scope.Deployment.Id),
		attribute.String("resource.id", scope.Resource.Id),
		attribute.String("dependsOn", dependsOn),
	)

	program, err := cel.CompileProgram(dependsOn)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to compile selector: %v", err),
		).
			WithDetail("error", err.Error()).
			WithDetail("depends_on", dependsOn)
	}

	releaseTargets := e.getters.GetReleaseTargetsForResource(ctx, scope.Resource.Id)

	for _, rt := range releaseTargets {
		deployment, err := e.getters.GetDeployment(ctx, rt.DeploymentId)
		if err != nil || deployment == nil {
			continue
		}

		version := e.getters.GetCurrentlyDeployedVersion(ctx, rt)
		if version == nil {
			continue
		}

		celCtx := cel.BuildEntityContext(nil, deployment, nil)
		celCtx["version"] = cel.DeploymentVersionToMap(version)
		matched, err := celutil.EvalBool(program, celCtx)
		if err != nil {
			continue
		}

		if matched {
			return results.NewAllowedResult(
				fmt.Sprintf(
					"Deployment dependency: upstream %s has matching deployed version %s",
					deployment.Name,
					version.Tag,
				),
			)
		}
	}

	return results.NewDeniedResult(
		fmt.Sprintf(
			"Deployment dependency: no upstream release target with a successful release matches selector: %s",
			dependsOn,
		),
	).
		WithDetail("depends_on", dependsOn)
}
