package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	"workspace-engine/pkg/config"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v66/github"
)

var _ types.Dispatchable = &GithubAction{}

type GithubAction struct {
	store *store.Store
}

func NewGithubAction(store *store.Store) *GithubAction {
	return &GithubAction{store: store}
}

func (a *GithubAction) Type() string {
	return "github-action"
}

func (a *GithubAction) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: false,
	}
}

// Dispatch implements types.Dispatchable.
func (a *GithubAction) Dispatch(ctx context.Context, context types.DispatchContext) error {
	cfg, err := a.parseJobAgentConfig(context.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	ghEntity, exists := a.store.GithubEntities.Get(cfg.Owner, cfg.InstallationId)
	if !exists {
		return fmt.Errorf("github entity not found for job %s", context.Job.Id)
	}

	client, err := a.createGithubClient(ghEntity, &cfg)
	if err != nil {
		return fmt.Errorf("failed to create github client: %w", err)
	}

	ref := "main"
	if cfg.Ref != nil {
		ref = *cfg.Ref
	}

	if _, err := client.Actions.CreateWorkflowDispatchEventByID(ctx, cfg.Owner, cfg.Repo, cfg.WorkflowId, github.CreateWorkflowDispatchEventRequest{
		Ref:    ref,
		Inputs: map[string]any{"job_id": context.Job.Id},
	}); err != nil {
		return fmt.Errorf("failed to dispatch workflow: %w", err)
	}

	return nil
}

func (a *GithubAction) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (oapi.GithubJobAgentConfig, error) {
	installationId, ok := jobAgentConfig["installationId"].(int)
	if !ok || installationId == 0 {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("installationId is required")
	}

	owner, ok := jobAgentConfig["owner"].(string)
	if !ok || owner == "" {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("owner is required")
	}

	repo, ok := jobAgentConfig["repo"].(string)
	if !ok || repo == "" {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("repo is required")
	}

	workflowId, ok := jobAgentConfig["workflowId"].(int64)
	if !ok || workflowId == 0 {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("workflowId is required")
	}

	var ref *string
	if cfgRef, ok := jobAgentConfig["ref"].(string); ok && cfgRef != "" {
		ref = &cfgRef
	}

	return oapi.GithubJobAgentConfig{
		InstallationId: installationId,
		Owner:          owner,
		Repo:           repo,
		WorkflowId:     workflowId,
		Ref:            ref,
	}, nil
}

func (a *GithubAction) createGithubClient(ghEntity *oapi.GithubEntity, cfg *oapi.GithubJobAgentConfig) (*github.Client, error) {

	jwtToken, err := a.generateJWT(int64(ghEntity.InstallationId), []byte(config.Global.GithubBotPrivateKey))
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	installationToken, err := a.getInstallationToken(jwtToken, cfg.InstallationId)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}

	return github.NewClient(nil).WithAuthToken(installationToken), nil
}

func (a *GithubAction) generateJWT(appID int64, privateKey []byte) (string, error) {
	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
		Issuer:    strconv.FormatInt(appID, 10),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signedToken, nil
}

func (a *GithubAction) getInstallationToken(jwtToken string, installationID int) (string, error) {
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
