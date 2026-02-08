package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_TerraformCloudJobAgentConfigMerge(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	jobAgent := c.NewJobAgent(workspaceID)
	jobAgent.Type = "tfe"
	jobAgent.Config = map[string]any{
		"address":      "https://app.terraform.io",
		"organization": "org-agent",
		"token":        "token-agent",
		"template":     "name: agent-workspace",
	}
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{
		"organization": "org-deployment",
		"template":     "name: deployment-workspace",
	}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	version.JobAgentConfig = map[string]any{
		"token":    "token-version",
		"template": "name: version-workspace",
	}
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	if job.JobAgentId != jobAgent.Id {
		t.Fatalf("expected job agent id %s, got %s", jobAgent.Id, job.JobAgentId)
	}

	cfg := job.JobAgentConfig
	if cfg["address"] != "https://app.terraform.io" {
		t.Fatalf("expected address from agent config, got %v", cfg["address"])
	}
	if cfg["organization"] != "org-deployment" {
		t.Fatalf("expected organization from deployment config, got %v", cfg["organization"])
	}
	if cfg["token"] != "token-version" {
		t.Fatalf("expected token from version config, got %v", cfg["token"])
	}
	if cfg["template"] != "name: version-workspace" {
		t.Fatalf("expected template from version config, got %v", cfg["template"])
	}
}
