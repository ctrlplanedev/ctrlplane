package versionselector

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func setupTestStore(t *testing.T) (*store.Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	sc := statechange.NewChangeSet[any]()
	s := store.New("test-workspace", sc)
	return s, ctx
}

func createTestDeployment(ctx context.Context, s *store.Store) *oapi.Deployment {
	deployment := &oapi.Deployment{
		Id:       uuid.New().String(),
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: uuid.New().String(),
	}
	_ = s.Deployments.Upsert(ctx, deployment)
	return deployment
}

func createTestEnvironment(ctx context.Context, s *store.Store, systemID string) *oapi.Environment {
	env := &oapi.Environment{
		Id:       uuid.New().String(),
		Name:     "staging",
		SystemId: systemID,
	}
	_ = s.Environments.Upsert(ctx, env)
	return env
}

func createTestResource(ctx context.Context, s *store.Store, metadata map[string]string) *oapi.Resource {
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource-1",
		Kind:       "service",
		Metadata:   metadata,
	}
	_, _ = s.Resources.Upsert(ctx, resource)
	return resource
}

func createTestVersion(ctx context.Context, s *store.Store, deploymentID string, tag string, metadata map[string]string) *oapi.DeploymentVersion {
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentID,
		Tag:          tag,
		Name:         "Version " + tag,
		CreatedAt:    time.Now(),
		Metadata:     metadata,
	}
	s.DeploymentVersions.Upsert(ctx, version.Id, version)
	return version
}

func TestNewEvaluator(t *testing.T) {
	s, ctx := setupTestStore(t)

	t.Run("returns nil when rule is nil", func(t *testing.T) {
		eval := NewEvaluator(s, nil)
		assert.Nil(t, eval)
	})

	t.Run("returns nil when store is nil", func(t *testing.T) {
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}
		eval := NewEvaluator(nil, rule)
		assert.Nil(t, eval)
	})

	t.Run("returns evaluator when both rule and store are provided", func(t *testing.T) {
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}
		eval := NewEvaluator(s, rule)
		assert.NotNil(t, eval)
	})

	_ = ctx // Suppress unused warning
}

func TestScopeFields(t *testing.T) {
	s, _ := setupTestStore(t)

	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector: *selector,
		},
	}

	eval := &Evaluator{
		store:  s,
		ruleId: rule.Id,
		rule:   rule.VersionSelector,
	}

	scopeFields := eval.ScopeFields()

	// Should require Version, Environment, and ReleaseTarget
	assert.Equal(t, evaluator.ScopeVersion|evaluator.ScopeEnvironment|evaluator.ScopeReleaseTarget, scopeFields)
}

func TestEvaluateCEL_VersionTagMatching(t *testing.T) {
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, map[string]string{"tier": "staging"})

	t.Run("allows version when CEL expression matches", func(t *testing.T) {
		version := createTestVersion(ctx, s, deployment.Id, "v2.1.0", nil)

		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `version.tag.startsWith("v2.")`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
		version := createTestVersion(ctx, s, deployment.Id, "v1.5.0", nil)

		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `version.tag.startsWith("v2.")`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, nil)
	version := createTestVersion(ctx, s, deployment.Id, "v2.0.0", nil)

	t.Run("allows version for matching environment", func(t *testing.T) {
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `environment.name == "staging"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `environment.name == "production"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, map[string]string{"tier": "production", "region": "us-west"})
	version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", nil)

	t.Run("allows version when resource metadata matches", func(t *testing.T) {
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `resource.metadata["tier"] == "production"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `resource.metadata["tier"] == "staging"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, map[string]string{"canary": "true"})
	version := createTestVersion(ctx, s, deployment.Id, "v2.5.0-canary", map[string]string{"channel": "beta"})

	t.Run("allows version when all conditions match", func(t *testing.T) {
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `version.tag.startsWith("v2.") && environment.name == "staging" && resource.metadata["canary"] == "true"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
		selector := &oapi.Selector{}
		_ = selector.FromCelSelector(oapi.CelSelector{
			Cel: `version.tag.startsWith("v3.") && environment.name == "staging"`,
		})

		rule := &oapi.PolicyRule{
			Id: "versionSelector",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *selector,
			},
		}

		eval := NewEvaluator(s, rule)

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
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, nil)
	version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", nil)

	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: `invalid CEL expression!!!`,
	})

	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector: *selector,
		},
	}

	eval := NewEvaluator(s, rule)

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
	s, ctx := setupTestStore(t)

	deployment := createTestDeployment(ctx, s)
	environment := createTestEnvironment(ctx, s, deployment.SystemId)
	resource := createTestResource(ctx, s, nil)
	version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", nil)

	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: `version.tag.startsWith("v2.")`,
	})

	description := "Only deploy v2.x versions to staging"
	rule := &oapi.PolicyRule{
		Id: "versionSelector",
		VersionSelector: &oapi.VersionSelectorRule{
			Selector:    *selector,
			Description: &description,
		},
	}

	eval := NewEvaluator(s, rule)

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
