package jobdispatch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v66/github"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var ghTracer = otel.Tracer("GithubDispatcher")

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
	store         *store.Store
	clientFactory func(installationID int) (GithubClient, error)
}

func NewGithubDispatcher(store *store.Store) *GithubDispatcher {
	return &GithubDispatcher{
		store:         store,
		clientFactory: nil, // will use default
	}
}

// NewGithubDispatcherWithClientFactory creates a dispatcher with a custom client factory (useful for testing)
func NewGithubDispatcherWithClientFactory(store *store.Store, clientFactory func(installationID int) (GithubClient, error)) *GithubDispatcher {
	return &GithubDispatcher{
		store:         store,
		clientFactory: clientFactory,
	}
}

// generateJWT creates a JWT token for GitHub App authentication
// This matches what Node.js createAppAuth does internally
func (d *GithubDispatcher) generateJWT(appID int64, privateKey []byte) (string, error) {
	// Parse the private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the JWT claims (issued at time and expiration)
	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)), // 60 seconds in the past to allow for clock drift
		ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),  // Max 10 minutes
		Issuer:    strconv.FormatInt(appID, 10),
	}

	// Create and sign the token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signedToken, nil
}

// getInstallationToken exchanges JWT for an installation access token
// This matches what Node.js octokit.auth() does
func (d *GithubDispatcher) getInstallationToken(jwtToken string, installationID int) (string, error) {
	url := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", installationID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get installation token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to get installation token: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	return result.Token, nil
}

func (d *GithubDispatcher) createGithubClient(installationID int) (GithubClient, error) {
	appIDStr := config.Global.GithubBotAppID
	privateKey := config.Global.GithubBotPrivateKey
	// Note: clientID and clientSecret are available but not needed for GitHub App auth
	// They're used in Node.js but the actual authentication uses JWT + installation token

	if appIDStr == "" || privateKey == "" {
		return nil, fmt.Errorf("GitHub bot not configured: missing GITHUB_BOT_APP_ID or GITHUB_BOT_PRIVATE_KEY")
	}

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_BOT_APP_ID: %w", err)
	}

	// Step 1: Generate JWT token (like Node.js createAppAuth does)
	jwtToken, err := d.generateJWT(appID, []byte(privateKey))
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	// Step 2: Get installation access token (like Node.js octokit.auth() does)
	installationToken, err := d.getInstallationToken(jwtToken, installationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}

	// Step 3: Create GitHub client with the installation token (like Node.js does with Bearer token)
	client := github.NewClient(nil).WithAuthToken(installationToken)

	return &realGithubClient{
		client: client,
	}, nil
}

func (d *GithubDispatcher) sendToGithub(ctx context.Context, job *oapi.Job, cfg oapi.FullGithubJobAgentConfig, ghEntity *oapi.GithubEntity) error {
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
	ctx, span := ghTracer.Start(ctx, "GithubDispatcher.DispatchJob")
	defer span.End()

	cfg, err := job.JobAgentConfig.AsFullGithubJobAgentConfig()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		return err
	}

	span.SetAttributes(attribute.String("job.id", job.Id))

	ghEntity, exists := d.store.GithubEntities.Get(cfg.Owner, cfg.InstallationId)
	if !exists {
		span.RecordError(fmt.Errorf("github entity not found for job %s", job.Id))
		span.SetStatus(codes.Error, "github entity not found")
		return fmt.Errorf("github entity not found for job %s", job.Id)
	}

	if err = d.sendToGithub(ctx, job, cfg, ghEntity); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to send to github")
		return fmt.Errorf("failed to send to github: %w", err)
	}

	return nil
}
