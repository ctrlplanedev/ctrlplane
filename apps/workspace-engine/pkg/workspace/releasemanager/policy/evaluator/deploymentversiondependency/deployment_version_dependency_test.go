package deploymentversiondependency

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	getDependencies                       func() ([]DependencyEdge, error)
	getReleaseTargetForDeploymentResource func(depID, resID string) (*oapi.ReleaseTarget, error)
	getCurrentVersionForReleaseTarget     func(rt *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error)
}

func (m *mockGetters) GetDependencies(_ context.Context, _ string) ([]DependencyEdge, error) {
	return m.getDependencies()
}

func (m *mockGetters) GetReleaseTargetForDeploymentResource(
	_ context.Context, depID, resID string,
) (*oapi.ReleaseTarget, error) {
	return m.getReleaseTargetForDeploymentResource(depID, resID)
}

func (m *mockGetters) GetCurrentVersionForReleaseTarget(
	_ context.Context, rt *oapi.ReleaseTarget,
) (*oapi.DeploymentVersion, error) {
	return m.getCurrentVersionForReleaseTarget(rt)
}

func makeScope() evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Deployment: &oapi.Deployment{Id: uuid.New().String(), Name: "downstream"},
		Version:    &oapi.DeploymentVersion{Id: uuid.New().String(), Tag: "candidate"},
		Resource:   &oapi.Resource{Id: uuid.New().String(), Name: "resource"},
	}
}

func makeRT(depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		DeploymentId:  depID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resID,
	}
}

func makeVersion(tag string) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:       uuid.New().String(),
		Tag:      tag,
		Name:     tag,
		Status:   oapi.DeploymentVersionStatusReady,
		Metadata: map[string]string{},
	}
}

func makeVersionWithMetadata(tag string, metadata map[string]string) *oapi.DeploymentVersion {
	v := makeVersion(tag)
	v.Metadata = metadata
	return v
}

// alwaysReturnsRT and alwaysReturnsVersion are convenience defaults for cases
// where a test only cares about a particular getter's behavior.
func alwaysReturnsRT(d, r string) (*oapi.ReleaseTarget, error) { return makeRT(d, r), nil }

func newEval(m *mockGetters) *Evaluator { return &Evaluator{getters: m} }

// assertDenied checks that the result is a deny and that the human-readable
// reason is non-empty (we always populate one).
func assertDenied(t *testing.T, r *oapi.RuleEvaluation) {
	t.Helper()
	assert.False(t, r.Allowed, "expected deny, got allow: %s", r.Message)
	assert.NotEmpty(t, r.Message, "deny result should always have a message")
}

// ----------------------------------------------------------------------------
// 1. Core semantics
// ----------------------------------------------------------------------------

func TestEvaluator_NoDependenciesDeclared_Allows(t *testing.T) {
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) { return nil, nil },
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assert.True(t, r.Allowed)
}

func TestEvaluator_SingleDependencySatisfied_Allows(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{
				{DependencyDeploymentID: depID, VersionSelector: "version.tag == 'v2.0'"},
			}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v2.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assert.True(t, r.Allowed)
}

func TestEvaluator_SingleDependencyUnsatisfied_Denies(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{
				{DependencyDeploymentID: depID, VersionSelector: "version.tag == 'v2.0'"},
			}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v1.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

func TestEvaluator_MultipleDependenciesAllSatisfied_Allows(t *testing.T) {
	dep1, dep2 := uuid.New().String(), uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{
				{DependencyDeploymentID: dep1, VersionSelector: "version.tag == 'v1.0'"},
				{DependencyDeploymentID: dep2, VersionSelector: "version.tag == 'v2.0'"},
			}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(rt *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			if rt.DeploymentId == dep1 {
				return makeVersion("v1.0"), nil
			}
			return makeVersion("v2.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assert.True(t, r.Allowed)
}

func TestEvaluator_MultipleDependenciesOneFails_Denies(t *testing.T) {
	dep1, dep2 := uuid.New().String(), uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{
				{DependencyDeploymentID: dep1, VersionSelector: "version.tag == 'v1.0'"},
				{DependencyDeploymentID: dep2, VersionSelector: "version.tag == 'v2.0'"},
			}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(rt *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			if rt.DeploymentId == dep1 {
				return makeVersion("v1.0"), nil
			}
			return makeVersion("v3.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

// ----------------------------------------------------------------------------
// 2. Missing prerequisites
// ----------------------------------------------------------------------------

func TestEvaluator_DependencyHasNoReleaseTargetOnResource_Denies(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{DependencyDeploymentID: depID, VersionSelector: "true"}}, nil
		},
		getReleaseTargetForDeploymentResource: func(_, _ string) (*oapi.ReleaseTarget, error) {
			return nil, nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

func TestEvaluator_DependencyHasReleaseTargetButNoSuccessfulRelease_Denies(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{DependencyDeploymentID: depID, VersionSelector: "true"}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return nil, nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

// ----------------------------------------------------------------------------
// 3. Realistic CEL semantics
// ----------------------------------------------------------------------------

func TestEvaluator_StartsWithMatches_Allows(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "version.tag.startsWith('v2')",
			}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v2.1.3"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assert.True(t, r.Allowed)
}

func TestEvaluator_StartsWithDoesNotMatch_Denies(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "version.tag.startsWith('v2')",
			}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v1.9.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

func TestEvaluator_SelectorReadsMetadata_Allows(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "version.metadata['channel'] == 'stable'",
			}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersionWithMetadata("v1.0", map[string]string{"channel": "stable"}), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assert.True(t, r.Allowed)
}

func TestEvaluator_DefaultFalseSelector_AlwaysDenies(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			// "false" is the schema default for version_selector.
			return []DependencyEdge{{DependencyDeploymentID: depID, VersionSelector: "false"}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v1.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

// ----------------------------------------------------------------------------
// 4. Configuration errors → deny + detail (product decision: deny-with-detail)
// ----------------------------------------------------------------------------

func TestEvaluator_InvalidCELSyntax_DeniesWithDetail(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "this is (((not valid cel",
			}}, nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
	assert.Contains(t, r.Message, "compile", "denial reason should hint at compile failure")
}

func TestEvaluator_NonBoolSelectorResult_DeniesWithDetail(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "version.tag",
			}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return makeVersion("v1.0"), nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

func TestEvaluator_SelectorReferencesUndefinedVar_DeniesWithDetail(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{
				DependencyDeploymentID: depID,
				VersionSelector:        "foo.bar == 'baz'",
			}}, nil
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
}

// ----------------------------------------------------------------------------
// 5. Infrastructure errors → deny + detail (product decision: deny-with-detail)
// ----------------------------------------------------------------------------

func TestEvaluator_GetDependenciesError_DeniesWithDetail(t *testing.T) {
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return nil, errors.New("db connection lost")
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
	assert.Contains(t, r.Message, "load dependencies")
}

func TestEvaluator_GetReleaseTargetError_DeniesWithDetail(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{DependencyDeploymentID: depID, VersionSelector: "true"}}, nil
		},
		getReleaseTargetForDeploymentResource: func(_, _ string) (*oapi.ReleaseTarget, error) {
			return nil, errors.New("query timed out")
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
	assert.Contains(t, r.Message, "release target")
}

func TestEvaluator_GetCurrentVersionError_DeniesWithDetail(t *testing.T) {
	depID := uuid.New().String()
	mock := &mockGetters{
		getDependencies: func() ([]DependencyEdge, error) {
			return []DependencyEdge{{DependencyDeploymentID: depID, VersionSelector: "true"}}, nil
		},
		getReleaseTargetForDeploymentResource: alwaysReturnsRT,
		getCurrentVersionForReleaseTarget: func(_ *oapi.ReleaseTarget) (*oapi.DeploymentVersion, error) {
			return nil, errors.New("scan failed")
		},
	}
	r := newEval(mock).Evaluate(context.Background(), makeScope())
	assertDenied(t, r)
	assert.Contains(t, r.Message, "current version")
}
