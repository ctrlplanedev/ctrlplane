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

	deployments, err := e.getters.GetAllDeployments(ctx, scope.Environment.WorkspaceId)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to get deployments: %v", err),
		).
			WithDetail("error", err.Error())
	}

	releaseTargets := e.getters.GetReleaseTargetsForResource(ctx, scope.Resource.Id)

	var evalErrors []string
	for _, rt := range releaseTargets {
		if rt.DeploymentId == scope.Deployment.Id && rt.EnvironmentId == scope.Environment.Id && rt.ResourceId == scope.Resource.Id {
			continue
		}

		deployment := deployments[rt.DeploymentId]
		if deployment == nil {
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
			span.RecordError(err)
			evalErrors = append(evalErrors, fmt.Sprintf("rt %s: CEL evaluation error: %v", rt.Key(), err))
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

	result := results.NewDeniedResult(
		fmt.Sprintf(
			"Deployment dependency: no upstream release target with a successful release matches selector: %s",
			dependsOn,
		),
	).
		WithDetail("depends_on", dependsOn)

	if len(evalErrors) > 0 {
		result = result.WithDetail("errors", fmt.Sprintf("%v", evalErrors))
	}

	return result
}
