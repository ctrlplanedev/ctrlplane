package e2e

import (
	"context"
	"encoding/json"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_ArgoCD_TemplatePreservedInJobFlow traces the full ArgoCD template flow
// from DeploymentVersion creation through to Job creation.
// This verifies that the template field in JobAgentConfig is preserved at each step.
func TestEngine_ArgoCD_TemplatePreservedInJobFlow(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()
	versionId := uuid.New().String()

	// The template exactly as it would come from the CLI (job-agent-config.json)
	argoCDTemplate := `---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: '{{.Resource.Name}}-console'
  namespace: argocd
  labels:
    app.kubernetes.io/name: console
    environment: '{{.Environment.Name}}'
    deployment: console
    resource: '{{.Resource.Name}}'
spec:
  project: default
  source:
    repoURL: git@github.com:wandb/deployments.git
    path: wandb/console
    targetRevision: '{{.Release.Version.Tag}}'
    helm:
      releaseName: console
  destination:
    name: '{{.Resource.Identifier}}'
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
`

	// Create ArgoCD job agent config
	argoCDJobAgentConfig := map[string]any{
		"type":      "argo-cd",
		"serverUrl": "argocd.wandb.dev",
		"apiKey":    "test-api-key",
	}

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("ArgoCD Agent"),
			integration.JobAgentType("argo-cd"),
			integration.JobAgentConfig(argoCDJobAgentConfig),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("console"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("wandb-vashe-awstest"),
			integration.ResourceIdentifier("wandb-vashe-awstest-cluster"),
			integration.ResourceKind("kubernetes"),
		),
	)

	ctx := context.Background()

	// Verify release target was created
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	require.NoError(t, err)
	require.Len(t, releaseTargets, 1, "expected 1 release target")

	// Create deployment version with ArgoCD template in JobAgentConfig
	// This simulates what the CLI does: ctrlc api upsert version --job-agent-config-file job-agent-config.json
	versionJobAgentConfig := map[string]any{
		"type":     "argo-cd",
		"template": argoCDTemplate,
	}

	dv := c.NewDeploymentVersion()
	dv.Id = versionId
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	dv.JobAgentConfig = versionJobAgentConfig

	// Log the version's JobAgentConfig before pushing the event
	t.Logf("=== STEP 1: Version JobAgentConfig before event push ===")
	dvConfigBytes, _ := json.MarshalIndent(dv.JobAgentConfig, "", "  ")
	t.Logf("DeploymentVersion.JobAgentConfig:\n%s", string(dvConfigBytes))

	// Check template presence in version before event
	if template, ok := dv.JobAgentConfig["template"]; ok {
		t.Logf("✓ Template present in version before event push (length: %d)", len(template.(string)))
	} else {
		t.Errorf("✗ Template NOT present in version before event push")
	}

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// STEP 2: Check the stored version
	t.Logf("=== STEP 2: Checking stored version ===")
	storedVersion, found := engine.Workspace().DeploymentVersions().Get(versionId)
	require.True(t, found, "stored version not found")

	storedConfigBytes, _ := json.MarshalIndent(storedVersion.JobAgentConfig, "", "  ")
	t.Logf("Stored version JobAgentConfig:\n%s", string(storedConfigBytes))

	if template, ok := storedVersion.JobAgentConfig["template"]; ok {
		t.Logf("✓ Template present in stored version (length: %d)", len(template.(string)))
	} else {
		t.Errorf("✗ Template NOT present in stored version - THIS IS WHERE IT'S LOST")
	}

	// STEP 3: Check pending jobs
	t.Logf("=== STEP 3: Checking pending jobs ===")
	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected 1 pending job")

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	// Get the release for this job
	release, found := engine.Workspace().Releases().Get(job.ReleaseId)
	require.True(t, found, "release not found for job")

	// STEP 4: Check the release's version JobAgentConfig
	t.Logf("=== STEP 4: Checking release's version ===")
	releaseVersionConfigBytes, _ := json.MarshalIndent(release.Version.JobAgentConfig, "", "  ")
	t.Logf("Release.Version.JobAgentConfig:\n%s", string(releaseVersionConfigBytes))

	if template, ok := release.Version.JobAgentConfig["template"]; ok {
		t.Logf("✓ Template present in release.Version (length: %d)", len(template.(string)))
	} else {
		t.Errorf("✗ Template NOT present in release.Version")
	}

	// STEP 5: Check the job's merged config
	t.Logf("=== STEP 5: Checking job's merged config ===")
	jobConfigBytes, _ := job.JobAgentConfig.MarshalJSON()
	t.Logf("Job.JobAgentConfig:\n%s", string(jobConfigBytes))

	// Try to get it as ArgoCD config
	argoCDConfig, err := job.JobAgentConfig.AsFullArgoCDJobAgentConfig()
	if err != nil {
		t.Logf("Could not parse as ArgoCD config: %v", err)
		// Try as custom config
		customConfig, err := job.JobAgentConfig.AsFullCustomJobAgentConfig()
		if err != nil {
			t.Errorf("Could not parse job config as either ArgoCD or Custom: %v", err)
		} else {
			t.Logf("Parsed as custom config: %+v", customConfig)
			if template, ok := customConfig.AdditionalProperties["template"]; ok {
				t.Logf("✓ Template found in custom config (length: %d)", len(template.(string)))
			} else {
				t.Errorf("✗ Template NOT found in job config (custom)")
			}
		}
	} else {
		t.Logf("Parsed as ArgoCD config:")
		t.Logf("  - Type: %s", argoCDConfig.Type)
		t.Logf("  - ServerUrl: %s", argoCDConfig.ServerUrl)
		t.Logf("  - Template length: %d", len(argoCDConfig.Template))

		if argoCDConfig.Template != "" {
			t.Logf("✓ Template present in job's ArgoCD config")
			assert.Contains(t, argoCDConfig.Template, "{{.Resource.Name}}-console", "template should contain resource name placeholder")
		} else {
			t.Errorf("✗ Template is EMPTY in job's ArgoCD config - THIS IS THE BUG")
		}
	}

	// Final assertions
	assert.Equal(t, oapi.JobStatusPending, job.Status)
	assert.Equal(t, jobAgentId, job.JobAgentId)
}

// TestEngine_ArgoCD_VersionJobAgentConfigPreservedThroughEventHandler tests that
// the JobAgentConfig is preserved when the event is handled by the workspace engine.
// This specifically tests the JSON marshaling/unmarshaling in the event handler.
func TestEngine_ArgoCD_VersionJobAgentConfigPreservedThroughEventHandler(t *testing.T) {
	// Create the version data exactly as it would come from the API/CLI
	versionData := map[string]any{
		"id":           uuid.New().String(),
		"deploymentId": uuid.New().String(),
		"tag":          "v1.0.0",
		"name":         "test-version",
		"status":       "ready",
		"config":       map[string]any{},
		"metadata":     map[string]string{},
		"createdAt":    "2024-01-01T00:00:00Z",
		"jobAgentConfig": map[string]any{
			"type":     "argo-cd",
			"template": "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: '{{.Resource.Name}}'",
		},
	}

	// Marshal to JSON (simulating what comes over the wire)
	jsonData, err := json.Marshal(versionData)
	require.NoError(t, err)

	t.Logf("JSON event data:\n%s", string(jsonData))

	// Unmarshal into DeploymentVersion (simulating event handler)
	var dv oapi.DeploymentVersion
	err = json.Unmarshal(jsonData, &dv)
	require.NoError(t, err)

	t.Logf("Unmarshaled version JobAgentConfig: %+v", dv.JobAgentConfig)

	// Check template is preserved
	template, ok := dv.JobAgentConfig["template"]
	require.True(t, ok, "template field should be present in JobAgentConfig")
	assert.Contains(t, template.(string), "{{.Resource.Name}}", "template should contain resource name placeholder")
}

// TestEngine_ArgoCD_VersionJobAgentConfigWithExactCLIFormat tests the exact format
// that the CLI sends when using --job-agent-config-file flag.
// This simulates: ctrlc api upsert version --job-agent-config-file job-agent-config.json
func TestEngine_ArgoCD_VersionJobAgentConfigWithExactCLIFormat(t *testing.T) {
	// This is the exact JSON content from the user's job-agent-config.json file
	jobAgentConfigJSON := `{
  "template": "---\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: '{{.Resource.Name}}-console'\n  namespace: argocd\n  labels:\n    app.kubernetes.io/name: console\n    environment: '{{.Environment.Name}}'\n    deployment: console\n    resource: '{{.Resource.Name}}'\nspec:\n  project: default\n  source:\n    repoURL: git@github.com:wandb/deployments.git\n    path: wandb/console\n    targetRevision: '{{.Release.Version.Tag}}'\n    helm:\n      releaseName: console\n  destination:\n    name: '{{.Resource.Identifier}}'\n    namespace: default\n  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true\n    syncOptions:\n    - CreateNamespace=true\n",
  "type": "argo-cd"
}`	// Parse it like the CLI does
	var jobAgentConfig map[string]interface{}
	err := json.Unmarshal([]byte(jobAgentConfigJSON), &jobAgentConfig)
	require.NoError(t, err)	t.Logf("Parsed jobAgentConfig from CLI: %+v", jobAgentConfig)	// Check template is present
	template, ok := jobAgentConfig["template"]
	require.True(t, ok, "template field should be present")
	require.NotEmpty(t, template, "template should not be empty")	templateStr := template.(string)
	t.Logf("Template length: %d", len(templateStr))
	assert.Contains(t, templateStr, "{{.Resource.Name}}-console", "template should contain the expected placeholder")

	// Now simulate what happens when this is sent through the API and event handler
	// The API creates the version data like this:
	versionData := map[string]any{
		"id":             uuid.New().String(),
		"deploymentId":   uuid.New().String(),
		"tag":            "v1.0.0",
		"name":           "test-version",
		"status":         "ready",
		"config":         map[string]any{},
		"metadata":       map[string]string{},
		"createdAt":      "2024-01-01T00:00:00Z",
		"jobAgentConfig": jobAgentConfig, // This is what the API does
	}

	// Marshal to JSON (simulating what goes to Kafka)
	eventJSON, err := json.Marshal(versionData)
	require.NoError(t, err)

	t.Logf("Event JSON:\n%s", string(eventJSON))

	// Unmarshal into DeploymentVersion (simulating workspace engine event handler)
	var dv oapi.DeploymentVersion
	err = json.Unmarshal(eventJSON, &dv)
	require.NoError(t, err)

	// Verify template is still present after event handling
	resultTemplate, ok := dv.JobAgentConfig["template"]
	require.True(t, ok, "template should be present in DeploymentVersion.JobAgentConfig")

	resultTemplateStr := resultTemplate.(string)
	t.Logf("After event unmarshaling - Template length: %d", len(resultTemplateStr))
	assert.Equal(t, len(templateStr), len(resultTemplateStr), "template length should be preserved")
	assert.Contains(t, resultTemplateStr, "{{.Resource.Name}}-console", "template content should be preserved")
}
