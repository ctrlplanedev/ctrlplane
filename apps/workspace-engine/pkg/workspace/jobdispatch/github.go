package jobdispatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/bradleyfalzon/ghinstallation/v2"
	"github.com/google/go-github/v66/github"
)

type githubJobConfig struct {
	InstallationId int     `json:"installationId"`
	Owner          string  `json:"owner"`
	Repo           string  `json:"repo"`
	WorkflowId     int     `json:"workflowId"`
	Ref            *string `json:"ref,omitempty"`
}

// GithubClient interface for dispatching workflows
type GithubClient interface {
	DispatchWorkflow(ctx context.Context, owner, repo string, workflowID int64, ref string, inputs map[string]any) error
}

// realGithubClient implements GithubClient using the actual GitHub API
type realGithubClient struct {
	client *github.Client
}

func (r *realGithubClient) DispatchWorkflow(ctx context.Context, owner, repo string, workflowID int64, ref string, inputs map[string]any) error {
	_, err := r.client.Actions.CreateWorkflowDispatchEventByID(
		ctx,
		owner,
		repo,
		workflowID,
		github.CreateWorkflowDispatchEventRequest{
			Ref:    ref,
			Inputs: inputs,
		},
	)
	return err
}

type GithubDispatcher struct {
	repo          *repository.Repository
	clientFactory func(installationID int) (GithubClient, error)
}

func NewGithubDispatcher(repo *repository.Repository) *GithubDispatcher {
	return &GithubDispatcher{
		repo:          repo,
		clientFactory: nil, // will use default
	}
}

// NewGithubDispatcherWithClientFactory creates a dispatcher with a custom client factory (useful for testing)
func NewGithubDispatcherWithClientFactory(repo *repository.Repository, clientFactory func(installationID int) (GithubClient, error)) *GithubDispatcher {
	return &GithubDispatcher{
		repo:          repo,
		clientFactory: clientFactory,
	}
}

func (d *GithubDispatcher) parseConfig(job *oapi.Job) (githubJobConfig, error) {
	var parsed githubJobConfig
	rawCfg, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return githubJobConfig{}, err
	}
	if err := json.Unmarshal(rawCfg, &parsed); err != nil {
		return githubJobConfig{}, err
	}
	if parsed.InstallationId == 0 {
		return githubJobConfig{}, fmt.Errorf("missing required GitHub job config: installationId")
	}
	if parsed.Owner == "" {
		return githubJobConfig{}, fmt.Errorf("missing required GitHub job config: owner")
	}
	if parsed.Repo == "" {
		return githubJobConfig{}, fmt.Errorf("missing required GitHub job config: repo")
	}
	if parsed.WorkflowId == 0 {
		return githubJobConfig{}, fmt.Errorf("missing required GitHub job config: workflowId")
	}
	return parsed, nil
}

func (d *GithubDispatcher) getGithubEntity(cfg githubJobConfig) *oapi.GithubEntity {
	ghEntities := d.repo.GithubEntities.IterBuffered()
	for ghEntity := range ghEntities {
		if ghEntity.Val.InstallationId == cfg.InstallationId && ghEntity.Val.Slug == cfg.Owner {
			return ghEntity.Val
		}
	}
	return nil
}

func (d *GithubDispatcher) getEnv(key string) string {
	return os.Getenv(key)
}

func (d *GithubDispatcher) createGithubClient(installationID int) (GithubClient, error) {
	appIDStr := d.getEnv("GITHUB_BOT_APP_ID")
	privateKey := d.getEnv("GITHUB_BOT_PRIVATE_KEY")

	if appIDStr == "" || privateKey == "" {
		return nil, fmt.Errorf("GitHub bot not configured: missing GITHUB_BOT_APP_ID or GITHUB_BOT_PRIVATE_KEY")
	}

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_BOT_APP_ID: %w", err)
	}

	itr, err := ghinstallation.New(
		http.DefaultTransport,
		appID,
		int64(installationID),
		[]byte(privateKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub installation transport: %w", err)
	}

	return &realGithubClient{
		client: github.NewClient(&http.Client{Transport: itr}),
	}, nil
}

func (d *GithubDispatcher) sendToGithub(ctx context.Context, job *oapi.Job, cfg githubJobConfig, ghEntity *oapi.GithubEntity) error {
	var client GithubClient
	var err error

	// Use custom client factory if provided, otherwise use default
	if d.clientFactory != nil {
		client, err = d.clientFactory(ghEntity.InstallationId)
	} else {
		client, err = d.createGithubClient(ghEntity.InstallationId)
	}

	if err != nil {
		return err
	}

	ref := "main"
	if cfg.Ref != nil {
		ref = *cfg.Ref
	}

	inputs := map[string]any{"job_id": job.Id}

	err = client.DispatchWorkflow(
		ctx,
		cfg.Owner,
		cfg.Repo,
		int64(cfg.WorkflowId),
		ref,
		inputs,
	)

	if err != nil {
		return fmt.Errorf("failed to dispatch workflow: %w", err)
	}

	return nil
}

func (d *GithubDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	cfg, err := d.parseConfig(job)
	if err != nil {
		return err
	}

	ghEntity := d.getGithubEntity(cfg)
	if ghEntity == nil {
		return fmt.Errorf("github entity not found for job %s", job.Id)
	}

	return d.sendToGithub(ctx, job, cfg, ghEntity)
}
