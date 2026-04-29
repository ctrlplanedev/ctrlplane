package deploymentversiondependency

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

var tracer = otel.Tracer("DeploymentVersionDependencyEvaluator")

const RuleType = "deploymentVersionDependency"

type Evaluator struct {
	getters Getters
}

func NewEvaluator(getters Getters) evaluator.Evaluator {
	if getters == nil {
		return nil
	}
	return evaluator.WithMemoization(&Evaluator{getters: getters})
}

func (e *Evaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion | evaluator.ScopeResource
}

func (e *Evaluator) RuleType() string { return RuleType }

func (e *Evaluator) RuleId() string { return "deployment-version-dependency" }

func (e *Evaluator) Complexity() int { return 3 }

func (e *Evaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "DeploymentVersionDependencyEvaluator.Evaluate")
	defer span.End()

	span.SetAttributes(
		attribute.String("version.id", scope.Version.Id),
		attribute.String("resource.id", scope.Resource.Id),
	)

	edges, err := e.getters.GetDependencies(ctx, scope.Version.Id)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to load dependencies: %v", err),
		).WithDetail("error", err.Error())
	}

	if len(edges) == 0 {
		return results.NewAllowedResult("Deployment dependency: no dependencies declared")
	}

	for _, edge := range edges {
		if denied := e.evaluateEdge(ctx, scope, edge); denied != nil {
			return denied
		}
	}

	return results.NewAllowedResult("Deployment dependency: all dependencies satisfied")
}

func (e *Evaluator) evaluateEdge(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
	edge DependencyEdge,
) *oapi.RuleEvaluation {
	program, err := cel.CompileProgram(edge.VersionSelector)
	if err != nil {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to compile selector for %s: %v",
				edge.DependencyDeploymentID, err),
		).
			WithDetail("dependency_deployment_id", edge.DependencyDeploymentID).
			WithDetail("version_selector", edge.VersionSelector)
	}

	rt, err := e.getters.GetReleaseTargetForDeploymentResource(
		ctx, edge.DependencyDeploymentID, scope.Resource.Id,
	)
	if err != nil {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to look up release target for %s: %v",
				edge.DependencyDeploymentID, err),
		).WithDetail("dependency_deployment_id", edge.DependencyDeploymentID)
	}
	if rt == nil {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: dependency %s is not deployed on this resource",
				edge.DependencyDeploymentID),
		).WithDetail("dependency_deployment_id", edge.DependencyDeploymentID)
	}

	version, err := e.getters.GetCurrentVersionForReleaseTarget(ctx, rt)
	if err != nil {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to load current version for %s: %v",
				edge.DependencyDeploymentID, err),
		).WithDetail("dependency_deployment_id", edge.DependencyDeploymentID)
	}
	if version == nil {
		return results.NewDeniedResult(
			fmt.Sprintf(
				"Deployment dependency: dependency %s has no successful release on this resource",
				edge.DependencyDeploymentID,
			),
		).WithDetail("dependency_deployment_id", edge.DependencyDeploymentID)
	}

	celCtx := map[string]any{"version": cel.DeploymentVersionToMap(version)}
	matched, err := celutil.EvalBool(program, celCtx)
	if err != nil {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: CEL evaluation error for %s: %v",
				edge.DependencyDeploymentID, err),
		).
			WithDetail("dependency_deployment_id", edge.DependencyDeploymentID).
			WithDetail("version_selector", edge.VersionSelector)
	}
	if !matched {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: dependency %s version %s does not satisfy selector",
				edge.DependencyDeploymentID, version.Tag),
		).
			WithDetail("dependency_deployment_id", edge.DependencyDeploymentID).
			WithDetail("dependency_version", version.Tag).
			WithDetail("version_selector", edge.VersionSelector)
	}

	return nil
}
