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
	return "github-app"
}

func (a *GithubAction) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: true,
	}
}

// Dispatch implements types.Dispatchable.
func (a *GithubAction) Dispatch(ctx context.Context, dispatchCtx types.DispatchContext) error {
	cfg, err := a.parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	client, err := a.createGithubClient(&cfg)
	if err != nil {
		return fmt.Errorf("failed to create github client: %w", err)
	}

	ref := "main"
	if cfg.Ref != nil {
		ref = *cfg.Ref
	}

	go func() {
		ctx := context.WithoutCancel(ctx)
		if _, err := client.Actions.CreateWorkflowDispatchEventByID(ctx, cfg.Owner, cfg.Repo, cfg.WorkflowId, github.CreateWorkflowDispatchEventRequest{
			Ref:    ref,
			Inputs: map[string]any{"job_id": dispatchCtx.Job.Id},
		}); err != nil {
			message := fmt.Sprintf("failed to dispatch workflow: %s", err.Error())
			dispatchCtx.Job.Status = oapi.JobStatusInvalidIntegration
			dispatchCtx.Job.UpdatedAt = time.Now()
			dispatchCtx.Job.Message = &message
			a.store.Jobs.Upsert(ctx, dispatchCtx.Job)
		}
	}()

	return nil
}

func (a *GithubAction) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (oapi.GithubJobAgentConfig, error) {
	installationId := toInt(jobAgentConfig["installationId"])
	if installationId == 0 {
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

	workflowId := toInt64(jobAgentConfig["workflowId"])
	if workflowId == 0 {
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

func (a *GithubAction) createGithubClient(cfg *oapi.GithubJobAgentConfig) (*github.Client, error) {
	appIDStr := config.Global.GithubBotAppID
	privateKey := config.Global.GithubBotPrivateKey

	if appIDStr == "" || privateKey == "" {
		return nil, fmt.Errorf("GitHub bot not configured: missing GITHUB_BOT_APP_ID or GITHUB_BOT_PRIVATE_KEY")
	}

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_BOT_APP_ID: %w", err)
	}

	jwtToken, err := a.generateJWT(appID, []byte(privateKey))
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

func toInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case float64:
		return int(val)
	default:
		return 0
	}
}

func toInt64(v interface{}) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	default:
		return 0
	}
}
