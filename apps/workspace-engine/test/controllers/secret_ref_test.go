package controllers_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	. "workspace-engine/test/controllers/harness"
)

// TestSecretRef_Resolved_FlowsThroughRelease covers the happy path: a
// variable_value of kind secret_ref → variableresolver.Resolve calls the
// injected SecretResolver → resolved plaintext lands on release.Variables
// and the variable key is appended to release.EncryptedVariables.
func TestSecretRef_Resolved_FlowsThroughRelease(t *testing.T) {
	fake := NewFakeSecretResolver()
	fake.Set("doppler-platform", "backend/production", "ARGOCD_TOKEN", "resolved-token-value")

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("argocd_token",
			WithVariableValue(SecretRefValue(
				"doppler-platform",
				"ARGOCD_TOKEN",
				"backend", "production",
			)),
		),
		WithSecretResolver(fake),
	)
	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "argocd_token", "resolved-token-value")
	p.AssertReleaseEncryptedVariables(t, 0, "argocd_token")

	require.Len(t, fake.Calls, 1, "expected secret resolver to be called once")
	assert.Equal(t, "doppler-platform", fake.Calls[0].Provider)
	assert.Equal(t, "backend/production", fake.Calls[0].Path)
	assert.Equal(t, "ARGOCD_TOKEN", fake.Calls[0].Key)
}

// TestSecretRef_MixedWithLiteral verifies that EncryptedVariables only
// contains the secret_ref-originated keys, not literals.
func TestSecretRef_MixedWithLiteral(t *testing.T) {
	fake := NewFakeSecretResolver()
	fake.Set("aws-prod", "prod/db", "password", "hunter2")

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("nginx:latest")),
		WithDeploymentVariable("db_password",
			WithVariableValue(SecretRefValue("aws-prod", "password", "prod/db")),
		),
		WithSecretResolver(fake),
	)
	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 2)
	p.AssertReleaseVariableEquals(t, 0, "image", "nginx:latest")
	p.AssertReleaseVariableEquals(t, 0, "db_password", "hunter2")
	p.AssertReleaseEncryptedVariables(t, 0, "db_password")
}

// TestSecretRef_NoPath covers providers whose reference does not carry a
// path component (e.g. env). The SecretReference passed to the resolver has
// an empty Path.
func TestSecretRef_NoPath(t *testing.T) {
	fake := NewFakeSecretResolver()
	fake.Set("env-defaults", "", "LICENSE_KEY", "abc-123")

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("license_key",
			WithVariableValue(SecretRefValue("env-defaults", "LICENSE_KEY")),
		),
		WithSecretResolver(fake),
	)
	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "license_key", "abc-123")
	p.AssertReleaseEncryptedVariables(t, 0, "license_key")

	require.Len(t, fake.Calls, 1)
	assert.Empty(t, fake.Calls[0].Path)
}

// TestSecretRef_ResolverError_NoRelease covers the failure path: a
// provider outage (or any resolver error) propagates up and blocks the
// release. desiredrelease.Reconcile must not persist a release in that
// case — Phase 5 was explicit that re-resolve-each-dispatch means an
// outage is observable as a stuck reconcile, not a silent literal.
func TestSecretRef_ResolverError_NoRelease(t *testing.T) {
	failing := &FailingSecretResolver{Err: errors.New("upstream 503")}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_password",
			WithVariableValue(SecretRefValue("doppler-prod", "DB_PASSWORD", "backend/prod")),
		),
		WithSecretResolver(failing),
	)
	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()
	err := p.ProcessDesiredReleasesErr()

	require.Error(t, err, "expected reconcile to propagate the upstream failure")
	assert.Contains(t, err.Error(), "upstream 503")
	p.AssertNoRelease(t)
	require.Len(t, failing.Calls, 1,
		"secret resolver must be called once before the failure surfaces")
}

// TestSecretRef_NoResolverConfigured covers the case where a secret_ref is
// encountered but no resolver was wired (e.g. VARIABLES_AES_256_KEY unset
// on the workspace-engine). The release is blocked with a clear error.
func TestSecretRef_NoResolverConfigured(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_password",
			WithVariableValue(SecretRefValue("doppler-prod", "DB_PASSWORD", "backend/prod")),
		),
	)
	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()
	err := p.ProcessDesiredReleasesErr()

	require.Error(t, err, "expected reconcile to fail with no SecretResolver wired")
	assert.Contains(t, err.Error(), "no SecretResolver configured")
	p.AssertNoRelease(t)
}
