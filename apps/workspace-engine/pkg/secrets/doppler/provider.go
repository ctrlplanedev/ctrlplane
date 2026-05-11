// Package doppler implements a secrets.Provider backed by the Doppler v3 API.
//
// SecretReference shape for Doppler:
//
//	Provider: secret_provider.name in the workspace
//	Path:     "<project>/<config>" (e.g. "backend/production")
//	Key:      Doppler secret name within the config (e.g. "ARGOCD_TOKEN")
//
// The provider talks to https://api.doppler.com/v3/configs/config/secret with
// a service-token Bearer header.
package doppler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"workspace-engine/pkg/secrets"
)

const (
	Type           = "doppler"
	defaultBaseURL = "https://api.doppler.com"
	defaultTimeout = 10 * time.Second
	tokenPrefix    = "dp.st."
)

// Config is the decrypted config payload for a doppler provider row.
type Config struct {
	ServiceToken string `json:"serviceToken"`
}

func (c Config) validate() error {
	if c.ServiceToken == "" {
		return fmt.Errorf("doppler provider: serviceToken is required")
	}
	if !strings.HasPrefix(c.ServiceToken, tokenPrefix) {
		return fmt.Errorf("doppler provider: serviceToken must start with %q", tokenPrefix)
	}
	return nil
}

type Provider struct {
	serviceToken string
	baseURL      string
	client       *http.Client
}

// Factory matches secrets.ProviderFactory.
func Factory(raw json.RawMessage) (secrets.Provider, error) {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("doppler provider: parse config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &Provider{
		serviceToken: cfg.ServiceToken,
		baseURL:      defaultBaseURL,
		client:       &http.Client{Timeout: defaultTimeout},
	}, nil
}

func (*Provider) Type() string { return Type }

func (p *Provider) Resolve(ctx context.Context, ref secrets.SecretReference) (string, error) {
	project, config, err := parsePath(ref.Path)
	if err != nil {
		return "", err
	}

	u, err := url.Parse(p.baseURL + "/v3/configs/config/secret")
	if err != nil {
		return "", fmt.Errorf("doppler provider: bad baseURL: %w", err)
	}
	q := u.Query()
	q.Set("project", project)
	q.Set("config", config)
	q.Set("name", ref.Key)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("doppler provider: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.serviceToken)
	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("doppler provider: HTTP call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf(
			"doppler provider: secret %s/%s/%s lookup returned %d",
			project,
			config,
			ref.Key,
			resp.StatusCode,
		)
	}

	var payload struct {
		Value struct {
			Computed string `json:"computed"`
			Raw      string `json:"raw"`
		} `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("doppler provider: decode response: %w", err)
	}
	if payload.Value.Computed != "" {
		return payload.Value.Computed, nil
	}
	if payload.Value.Raw != "" {
		return payload.Value.Raw, nil
	}
	return "", fmt.Errorf(
		"doppler provider: secret %s/%s/%s has empty value",
		project,
		config,
		ref.Key,
	)
}

func parsePath(path string) (project, config string, err error) {
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", fmt.Errorf(
			"doppler provider: path must be \"<project>/<config>\", got %q",
			path,
		)
	}
	return parts[0], parts[1], nil
}
