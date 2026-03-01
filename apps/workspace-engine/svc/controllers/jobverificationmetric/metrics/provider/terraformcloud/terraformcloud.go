package terraformcloud

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/hashicorp/go-tfe"
)

var _ provider.Provider = (*Provider)(nil)

type Config struct {
	Address string `json:"address"`
	Token   string `json:"token"`
	RunId   string `json:"runId"`
}

type Provider struct {
	config *Config
}

func New(config *Config) *Provider {
	return &Provider{config: config}
}

func NewFromJSON(data json.RawMessage) (*Provider, error) {
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("failed to unmarshal Terraform Cloud provider: %w", err)
	}
	return New(&c), nil
}

func (p *Provider) Type() string { return "terraformcloud" }

func (p *Provider) Config() *Config { return p.config }

func (p *Provider) convertRunToData(run *tfe.Run) map[string]any {
	return map[string]any{
		"runId":                run.ID,
		"status":               run.Status,
		"hasChanges":           run.HasChanges,
		"isDestroy":            run.IsDestroy,
		"refresh":              run.Refresh,
		"refreshOnly":          run.RefreshOnly,
		"replaceAddrs":         run.ReplaceAddrs,
		"savePlan":             run.SavePlan,
		"source":               run.Source,
		"statusTimestamps":     run.StatusTimestamps,
		"targetAddrs":          run.TargetAddrs,
		"terraformVersion":     run.TerraformVersion,
		"triggerReason":        run.TriggerReason,
		"variables":            run.Variables,
		"apply":                run.Apply,
		"configurationVersion": run.ConfigurationVersion,
		"costEstimate":         run.CostEstimate,
		"createdBy":            run.CreatedBy,
		"confirmedBy":          run.ConfirmedBy,
		"plan":                 run.Plan,
		"policyChecks":         run.PolicyChecks,
		"runEvents":            run.RunEvents,
		"taskStages":           run.TaskStages,
		"workspace":            run.Workspace,
		"comments":             run.Comments,
		"actions":              run.Actions,
		"policyPaths":          run.PolicyPaths,
		"positionInQueue":      run.PositionInQueue,
		"planOnly":             run.PlanOnly,
	}
}

func (p *Provider) Measure(ctx context.Context, _ *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	client, err := tfe.NewClient(&tfe.Config{
		Address: p.config.Address,
		Token:   p.config.Token,
	})
	if err != nil {
		return startTime, nil, err
	}

	run, err := client.Runs.Read(ctx, p.config.RunId)
	if err != nil {
		return startTime, nil, err
	}

	duration := time.Since(startTime)
	runData := p.convertRunToData(run)
	runData["duration"] = duration.Milliseconds()
	runData["url"] = fmt.Sprintf("%s/app/terraform-cloud/workspaces/%s/runs/%s", p.config.Address, run.Workspace.Name, run.ID)

	return startTime, runData, nil
}
