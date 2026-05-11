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
)

type Provider struct {
	serviceToken string
	baseURL      string
	client       *http.Client
}

// Factory matches secrets.ProviderFactory.
func Factory(cfg map[string]any) (secrets.Provider, error) {
	tokenRaw, ok := cfg["serviceToken"]
	if !ok {
		return nil, fmt.Errorf("doppler provider: missing serviceToken")
	}
	token, ok := tokenRaw.(string)
	if !ok || token == "" {
		return nil, fmt.Errorf("doppler provider: serviceToken must be a non-empty string")
	}
	if !strings.HasPrefix(token, "dp.st.") {
		return nil, fmt.Errorf("doppler provider: serviceToken must start with %q", "dp.st.")
	}
	return &Provider{
		serviceToken: token,
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
