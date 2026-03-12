package versionselector

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func createTestDeployment() (*oapi.Deployment, string) {
	return &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}, uuid.New().String()
}

func createTestEnvironment() *oapi.Environment {
	return &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "staging",
	}
}

func createTestResource(metadata map[string]string) *oapi.Resource {
	return &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource-1",
		Kind:       "service",
		Metadata:   metadata,
	}
}

func createTestVersion(
	deploymentID string,
	tag string,
	metadata map[string]string,
) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentID,
		Tag:          tag,
		Name:         "Version " + tag,
		CreatedAt:    time.Now(),
		Metadata:     metadata,
	}
}

func TestNewEvaluator(t *testing.T) {
	t.Run("returns nil when rule is nil", func(t *testing.T) {
		eval := NewEvaluator(nil)
		assert.Nil(t, eval)
	})

	t.Run("returns evaluator when rule has version selector", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "true",
			},
		}
		eval := NewEvaluator(rule)
		assert.NotNil(t, eval)
	})
}

func TestScopeFields(t *testing.T) {
	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector: "true",
		},
	}

	eval := &Evaluator{
		ruleId: rule.Id,
		rule:   rule.VersionSelector,
	}

	scopeFields := eval.ScopeFields()

	// Should require Version, Environment, and ReleaseTarget
	assert.Equal(
		t,
		evaluator.ScopeVersion|evaluator.ScopeEnvironment|evaluator.ScopeReleaseTarget,
		scopeFields,
	)
}

func TestEvaluateCEL_VersionTagMatching(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(map[string]string{"tier": "staging"})

	t.Run("allows version when CEL expression matches", func(t *testing.T) {
		version := createTestVersion(deployment.Id, "v2.1.0", nil)

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "version.tag.startsWith('v2.')",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.True(t, result.Allowed)
		assert.False(t, result.ActionRequired)
		assert.Contains(t, result.Message, "matches selector")
	})

	t.Run("blocks version when CEL expression does not match", func(t *testing.T) {
		version := createTestVersion(deployment.Id, "v1.5.0", nil)

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "version.tag.startsWith('v2.')",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.False(t, result.Allowed)
		assert.False(t, result.ActionRequired)
	})
}

func TestEvaluateCEL_EnvironmentMatching(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(nil)
	version := createTestVersion(deployment.Id, "v2.0.0", nil)

	t.Run("allows version for matching environment", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "environment.name == 'staging'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.True(t, result.Allowed)
	})

	t.Run("blocks version for non-matching environment", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "environment.name == 'production'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.False(t, result.Allowed)
	})
}

func TestEvaluateCEL_ResourceMetadataMatching(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(
		map[string]string{"tier": "production", "region": "us-west"},
	)
	version := createTestVersion(deployment.Id, "v1.0.0", nil)

	t.Run("allows version when resource metadata matches", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "resource.metadata['tier'] == 'production'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.True(t, result.Allowed)
	})

	t.Run("blocks version when resource metadata does not match", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "resource.metadata['tier'] == 'staging'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.False(t, result.Allowed)
	})
}

func TestEvaluateCEL_CombinedConditions(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(map[string]string{"canary": "true"})
	version := createTestVersion(
		deployment.Id,
		"v2.5.0-canary",
		map[string]string{"channel": "beta"},
	)

	t.Run("allows version when all conditions match", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "version.tag.startsWith('v2.') && environment.name == 'staging' && resource.metadata['canary'] == 'true'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.True(t, result.Allowed)
	})

	t.Run("blocks version when one condition fails", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: "version.tag.startsWith('v3.') && environment.name == 'staging'",
			},
		}

		eval := NewEvaluator(rule)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: environment,
			Resource:    resource,
			Deployment:  deployment,
		}

		result := eval.Evaluate(ctx, scope)

		assert.False(t, result.Allowed)
	})
}

func TestEvaluate_InvalidCEL(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(nil)
	version := createTestVersion(deployment.Id, "v1.0.0", nil)

	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector: "invalid cel expression!!!",
		},
	}

	eval := NewEvaluator(rule)

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: environment,
		Resource:    resource,
		Deployment:  deployment,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "failed to compile")
}

func TestEvaluate_WithDescription(t *testing.T) {
	ctx := context.Background()

	deployment, _ := createTestDeployment()
	environment := createTestEnvironment()
	resource := createTestResource(nil)
	version := createTestVersion(deployment.Id, "v1.0.0", nil)

	description := "Only deploy v2.x versions to staging"
	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector:    "version.tag.startsWith('v2.')",
			Description: &description,
		},
	}

	eval := NewEvaluator(rule)

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: environment,
		Resource:    resource,
		Deployment:  deployment,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, description)
}
