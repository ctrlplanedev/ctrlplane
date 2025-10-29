package evaluator

import (
	"context"
	"workspace-engine/pkg/oapi"
)

// WorkspaceScopedEvaluator evaluates policy rules at the workspace level,
// independent of any specific target, release, or version. These are the most
// general rules that apply across the entire workspace.
type WorkspaceScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
	) (*oapi.RuleEvaluation, error)
}

// TargetScopedEvaluator evaluates policy rules that apply to release targets
// themselves, independent of any specific release or version. These rules determine
// whether a target is eligible for deployments based on target-level constraints.
type TargetScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) (*oapi.RuleEvaluation, error)
}

// ReleaseScopedEvaluator evaluates policy rules that apply to entire releases within
// the context of a release target. These rules determine whether a release meets
// the policy requirements for deployment to a target.
type ReleaseScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
		release *oapi.Release,
	) (*oapi.RuleEvaluation, error)
}

// VersionScopedEvaluator evaluates policy rules that apply to specific deployment versions
// independent of any specific release target. These rules determine whether a particular
// version is allowed to be deployed to a target based on policy constraints.
type VersionScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
		version *oapi.DeploymentVersion,
	) (*oapi.RuleEvaluation, error)
}

type EnvironmentAndVersionScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
		environment *oapi.Environment,
		version *oapi.DeploymentVersion,
	) (*oapi.RuleEvaluation, error)
}

type EnvironmentAndVersionAndTargetScopedEvaluator interface {
	Evaluate(
		ctx context.Context,
		environment *oapi.Environment,
		version *oapi.DeploymentVersion,
		releaseTarget *oapi.ReleaseTarget,
	) (*oapi.RuleEvaluation, error)
}
