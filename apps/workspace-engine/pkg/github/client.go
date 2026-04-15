package github

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v66/github"
	"workspace-engine/pkg/config"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

func generateJWT() (string, error) {
	appIDStr := config.Global.GithubBotAppID
	privateKey := config.Global.GithubBotPrivateKey

	if appIDStr == "" || privateKey == "" {
		return "", fmt.Errorf(
			"GitHub bot not configured: missing GITHUB_BOT_APP_ID or GITHUB_BOT_PRIVATE_KEY",
		)
	}

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid GITHUB_BOT_APP_ID: %w", err)
	}

	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(privateKey))
	if err != nil {
		return "", fmt.Errorf("parse private key: %w", err)
	}

	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
		Issuer:    strconv.FormatInt(appID, 10),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(key)
}

func appClient() (*github.Client, error) {
	jwtStr, err := generateJWT()
	if err != nil {
		return nil, err
	}
	return github.NewClient(httpClient).WithAuthToken(jwtStr), nil
}

// CreateClientForInstallation returns a GitHub client authenticated as the
// given installation. Use this when the installation ID is already known
// (e.g. from a job agent config).
func CreateClientForInstallation(
	ctx context.Context,
	installationID int64,
) (*github.Client, error) {
	app, err := appClient()
	if err != nil {
		return nil, err
	}

	token, _, err := app.Apps.CreateInstallationToken(ctx, installationID, nil)
	if err != nil {
		return nil, fmt.Errorf("create installation token: %w", err)
	}

	return github.NewClient(httpClient).WithAuthToken(token.GetToken()), nil
}

// CreateClientForRepo returns a GitHub client authenticated for the
// installation that covers owner/repo. It discovers the installation via
// the GitHub API. Returns (nil, nil) if the GitHub bot is not configured.
func CreateClientForRepo(ctx context.Context, owner, repo string) (*github.Client, error) {
	app, err := appClient()
	if err != nil {
		if config.Global.GithubBotAppID == "" || config.Global.GithubBotPrivateKey == "" {
			return nil, nil
		}
		return nil, err
	}

	installation, _, err := app.Apps.FindRepositoryInstallation(ctx, owner, repo)
	if err != nil {
		return nil, fmt.Errorf("find installation for %s/%s: %w", owner, repo, err)
	}

	return CreateClientForInstallation(ctx, installation.GetID())
}
