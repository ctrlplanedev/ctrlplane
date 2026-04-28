package planvalidation

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEvaluate_NoViolations(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    input.proposed == ""
    msg := "proposed is empty"
}
`
	input := Input{
		Current:    "old content",
		Proposed:   "new content",
		AgentType:  "test",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.True(t, result.Passed)
	assert.Empty(t, result.Violations)
}

func TestEvaluate_WithViolations(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    input.hasChanges == true
    msg := "changes detected"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "changes detected", result.Violations[0].Msg)
}

func TestEvaluate_YAMLParsing(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

proposed_docs contains doc if {
    some raw in split(input.proposed, "\n---\n")
    doc := yaml.unmarshal(raw)
}

violation contains {"msg": msg} if {
    some m in proposed_docs
    m.kind == "Deployment"
    some c in m.spec.template.spec.containers
    not c.resources.limits
    msg := sprintf("Container %q missing resource limits", [c.name])
}
`
	proposed := `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: nginx:latest`

	input := Input{
		Current:    "",
		Proposed:   proposed,
		AgentType:  "argo-cd",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Contains(t, result.Violations[0].Msg, "app")
	assert.Contains(t, result.Violations[0].Msg, "missing resource limits")
}

func TestEvaluate_YAMLParsing_Pass(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

proposed_docs contains doc if {
    some raw in split(input.proposed, "\n---\n")
    doc := yaml.unmarshal(raw)
}

violation contains {"msg": msg} if {
    some m in proposed_docs
    m.kind == "Deployment"
    some c in m.spec.template.spec.containers
    not c.resources.limits
    msg := sprintf("Container %q missing resource limits", [c.name])
}
`
	proposed := `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: nginx:latest
        resources:
          limits:
            cpu: "100m"
            memory: "128Mi"`

	input := Input{
		Current:    "",
		Proposed:   proposed,
		AgentType:  "argo-cd",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.True(t, result.Passed)
	assert.Empty(t, result.Violations)
}

func TestEvaluate_DiffAware(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

current_docs contains doc if {
    some raw in split(input.current, "\n---\n")
    doc := yaml.unmarshal(raw)
}

proposed_docs contains doc if {
    some raw in split(input.proposed, "\n---\n")
    doc := yaml.unmarshal(raw)
}

violation contains {"msg": msg} if {
    some curr in current_docs
    some prop in proposed_docs
    curr.kind == "Deployment"
    prop.kind == "Deployment"
    curr.metadata.name == prop.metadata.name
    curr.spec.replicas > 0
    prop.spec.replicas < curr.spec.replicas * 0.5
    msg := sprintf("Replica count for %s drops from %d to %d (>50%% reduction)",
        [prop.metadata.name, curr.spec.replicas, prop.spec.replicas])
}
`
	current := `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 10`

	proposed := `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2`

	input := Input{
		Current:    current,
		Proposed:   proposed,
		AgentType:  "argo-cd",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Contains(t, result.Violations[0].Msg, "web")
	assert.Contains(t, result.Violations[0].Msg, "50%")
}

func TestEvaluate_EnvironmentAware(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    input.environment.name == "production"
    input.hasChanges == true
    msg := "production changes require manual approval"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
		Environment: map[string]any{
			"name": "production",
			"id":   "env-123",
		},
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "production changes require manual approval", result.Violations[0].Msg)
}

func TestEvaluate_CustomPackage(t *testing.T) {
	regoPolicy := `
package terraform.security

import rego.v1

violation contains {"msg": msg} if {
    input.hasChanges == true
    msg := "custom package detected changes"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "terraform-cloud",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "custom package detected changes", result.Violations[0].Msg)
}

func TestEvaluate_DenyRule(t *testing.T) {
	regoPolicy := `
package conftest.resource_limits

import rego.v1

deny contains msg if {
    input.hasChanges == true
    msg := "deny rule triggered"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "deny rule triggered", result.Violations[0].Msg)
}

func TestEvaluate_JSONParsing(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

plan := json.unmarshal(input.proposed)

violation contains {"msg": msg} if {
    some rc in plan.resource_changes
    some action in rc.change.actions
    action == "delete"
    msg := sprintf("Destructive change to %s blocked", [rc.address])
}
`
	proposed := `{
    "resource_changes": [
        {
            "address": "aws_instance.web",
            "change": { "actions": ["delete"] }
        }
    ]
}`
	input := Input{
		Current:    "{}",
		Proposed:   proposed,
		AgentType:  "terraform-cloud",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Contains(t, result.Violations[0].Msg, "aws_instance.web")
}

func TestEvaluate_VersionComparison(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    input.currentVersion
    input.proposedVersion
    input.currentVersion.tag > input.proposedVersion.tag
    msg := sprintf("Rollback detected: %s -> %s", [input.currentVersion.tag, input.proposedVersion.tag])
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
		ProposedVersion: map[string]any{
			"tag":  "v1.0.0",
			"name": "v1.0.0",
		},
		CurrentVersion: map[string]any{
			"tag":  "v2.0.0",
			"name": "v2.0.0",
		},
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Contains(t, result.Violations[0].Msg, "Rollback detected")
	assert.Contains(t, result.Violations[0].Msg, "v2.0.0 -> v1.0.0")
}

func TestEvaluate_VersionComparison_NoCurrentVersion(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    not input.currentVersion
    msg := "first deployment to this target"
}
`
	input := Input{
		Current:    "",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
		ProposedVersion: map[string]any{
			"tag":  "v1.0.0",
			"name": "v1.0.0",
		},
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "first deployment to this target", result.Violations[0].Msg)
}

func TestEvaluate_VersionMetadata(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

violation contains {"msg": msg} if {
    input.proposedVersion.metadata["requires-approval"] == "true"
    input.environment.name == "production"
    msg := "version requires manual approval for production"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
		Environment: map[string]any{
			"name": "production",
		},
		ProposedVersion: map[string]any{
			"tag":  "v2.0.0",
			"name": "v2.0.0",
			"metadata": map[string]string{
				"requires-approval": "true",
			},
		},
		CurrentVersion: map[string]any{
			"tag":  "v1.0.0",
			"name": "v1.0.0",
		},
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	require.Len(t, result.Violations, 1)
	assert.Equal(t, "version requires manual approval for production", result.Violations[0].Msg)
}

func TestEvaluate_DenyContainsIf(t *testing.T) {
	regoPolicy := `
package kubernetes.validation

import rego.v1

docs := [doc | some raw in split(input.proposed, "\n---\n"); doc := yaml.unmarshal(raw)]

deny contains msg if {
  some doc in docs
  doc.kind == "Service"
  doc.spec.type == "LoadBalancer"

  labels := object.get(doc.metadata, "labels", {})

  not labels["lb.coreweave.com/address-pool"]
  not labels["service.beta.kubernetes.io/coreweave-load-balancer-type"]

  msg := sprintf("Service '%s' must define either the label 'lb.coreweave.com/address-pool' or 'service.beta.kubernetes.io/coreweave-load-balancer-type'", [doc.metadata.name])
}
`
	t.Run("violation when labels missing", func(t *testing.T) {
		proposed := `apiVersion: v1
kind: Service
metadata:
  name: my-svc
  labels: {}
spec:
  type: LoadBalancer`

		input := Input{
			Proposed:   proposed,
			AgentType:  "kubernetes",
			HasChanges: true,
		}
		result, err := Evaluate(context.Background(), regoPolicy, input)
		require.NoError(t, err)
		assert.False(t, result.Passed)
		require.Len(t, result.Violations, 1)
		assert.Contains(t, result.Violations[0].Msg, "my-svc")
	})

	t.Run("pass when label present", func(t *testing.T) {
		proposed := `apiVersion: v1
kind: Service
metadata:
  name: my-svc
  labels:
    lb.coreweave.com/address-pool: default
spec:
  type: LoadBalancer`

		input := Input{
			Proposed:   proposed,
			AgentType:  "kubernetes",
			HasChanges: true,
		}
		result, err := Evaluate(context.Background(), regoPolicy, input)
		require.NoError(t, err)
		assert.True(t, result.Passed)
		assert.Empty(t, result.Violations)
	})
}

func TestEvaluate_InvalidRego(t *testing.T) {
	regoPolicy := `this is not valid rego`
	input := Input{AgentType: "test"}

	_, err := Evaluate(context.Background(), regoPolicy, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse rego module")
}

func TestEvaluate_MultipleViolations(t *testing.T) {
	regoPolicy := `
package ctrlplane.plan_validation

import rego.v1

proposed_docs contains doc if {
    some raw in split(input.proposed, "\n---\n")
    doc := yaml.unmarshal(raw)
}

violation contains {"msg": msg} if {
    some m in proposed_docs
    m.kind == "Deployment"
    some c in m.spec.template.spec.containers
    not c.resources.limits
    msg := sprintf("Container %q missing resource limits", [c.name])
}
`
	proposed := `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
      - name: app1
        image: nginx:latest
      - name: app2
        image: redis:latest`

	input := Input{
		Current:    "",
		Proposed:   proposed,
		AgentType:  "argo-cd",
		HasChanges: true,
	}

	result, err := Evaluate(context.Background(), regoPolicy, input)
	require.NoError(t, err)
	assert.False(t, result.Passed)
	assert.Len(t, result.Violations, 2)
}

func TestEvaluate_RegoV0_Rejected(t *testing.T) {
	regoPolicy := `
package conftest.labels

deny[msg] {
    input.hasChanges == true
    msg := "v0 syntax should be rejected"
}
`
	input := Input{
		Current:    "old",
		Proposed:   "new",
		AgentType:  "test",
		HasChanges: true,
	}

	_, err := Evaluate(context.Background(), regoPolicy, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse rego module")
}
