package github

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

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v66/github"
)

// GoGitHubWorkflowDispatcher is the production implementation that calls
// the GitHub API to dispatch workflows.
type GoGitHubWorkflowDispatcher struct{}

func (d *GoGitHubWorkflowDispatcher) DispatchWorkflow(ctx context.Context, cfg oapi.GithubJobAgentConfig, ref string, inputs map[string]any) error {
	client, err := createGithubClient(&cfg)
	if err != nil {
		return fmt.Errorf("failed to create github client: %w", err)
	}

	if _, err := client.Actions.CreateWorkflowDispatchEventByID(ctx, cfg.Owner, cfg.Repo, cfg.WorkflowId, github.CreateWorkflowDispatchEventRequest{
		Ref:    ref,
		Inputs: inputs,
	}); err != nil {
		return err
	}

	return nil
}

func createGithubClient(cfg *oapi.GithubJobAgentConfig) (*github.Client, error) {
	appIDStr := config.Global.GithubBotAppID
	privateKey := config.Global.GithubBotPrivateKey

	if appIDStr == "" || privateKey == "" {
		return nil, fmt.Errorf("GitHub bot not configured: missing GITHUB_BOT_APP_ID or GITHUB_BOT_PRIVATE_KEY")
	}

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_BOT_APP_ID: %w", err)
	}

	jwtToken, err := generateJWT(appID, []byte(privateKey))
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	installationToken, err := getInstallationToken(jwtToken, cfg.InstallationId)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}

	return github.NewClient(nil).WithAuthToken(installationToken), nil
}

func generateJWT(appID int64, privateKey []byte) (string, error) {
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

func getInstallationToken(jwtToken string, installationID int) (string, error) {
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
