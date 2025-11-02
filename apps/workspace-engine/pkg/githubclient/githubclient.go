package githubclient

import (
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

func generateJWT(appID int64, privateKey []byte) (string, error) {
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

func CreateGithubClient(ghEntity *oapi.GithubEntity) (*github.Client, error) {
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

	installationToken, err := getInstallationToken(jwtToken, ghEntity.InstallationId)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}

	return github.NewClient(nil).WithAuthToken(installationToken), nil
}
