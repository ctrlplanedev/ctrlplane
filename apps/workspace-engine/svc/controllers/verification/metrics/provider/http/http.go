package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/charmbracelet/log"
)

// Ensure Provider implements provider.Provider
var _ provider.Provider = (*Provider)(nil)

// Config contains HTTP metric configuration
type Config struct {
	URL     string
	Method  string
	Headers map[string]string
	Body    string
	Timeout time.Duration
}

// Provider executes HTTP-based metrics
type Provider struct {
	config *Config
}

// New creates a new HTTP metric provider
func New(config *Config) (*Provider, error) {
	// Set defaults
	if config.Method == "" {
		config.Method = "GET"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &Provider{
		config: config,
	}, nil
}

// NewFromOAPI creates a new HTTP provider from oapi.HTTPMetricProvider
func NewFromOAPI(oapiProvider any) (*Provider, error) {
	// Cast to the OAPI type - we use interface{} to avoid import cycles
	type httpProvider struct {
		URL     string             `json:"url"`
		Method  *string            `json:"method,omitempty"`
		Headers *map[string]string `json:"headers,omitempty"`
		Body    *string            `json:"body,omitempty"`
		Timeout *string            `json:"timeout,omitempty"`
	}

	// Marshal and unmarshal to convert
	data, err := json.Marshal(oapiProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal provider: %w", err)
	}

	var hp httpProvider
	if err := json.Unmarshal(data, &hp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal provider: %w", err)
	}

	config := &Config{
		URL:     hp.URL,
		Method:  "GET",
		Headers: make(map[string]string),
		Timeout: 30 * time.Second,
	}

	if hp.Method != nil {
		config.Method = *hp.Method
	}

	if hp.Headers != nil {
		config.Headers = *hp.Headers
	}

	if hp.Body != nil {
		config.Body = *hp.Body
	}

	if hp.Timeout != nil {
		timeout, err := time.ParseDuration(*hp.Timeout)
		if err != nil {
			return nil, fmt.Errorf("invalid timeout: %w", err)
		}
		config.Timeout = timeout
	}

	return New(config)
}

func (p *Provider) Type() string {
	return "http"
}

// Config returns the provider's configuration
func (p *Provider) Config() *Config {
	return p.config
}

// ConfigAsMetric returns the provider's configuration as metrics.HTTPConfig
// This allows the provider to implement metrics.HTTPConfigProvider without import cycles
func (p *Provider) ConfigAsMetric() interface{} {
	return struct {
		URL     string
		Method  string
		Headers map[string]string
		Body    string
		Timeout time.Duration
	}{
		URL:     p.config.URL,
		Method:  p.config.Method,
		Headers: p.config.Headers,
		Body:    p.config.Body,
		Timeout: p.config.Timeout,
	}
}

func (p *Provider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	resolved := Resolve(p.config, providerCtx)

	// Create HTTP request
	var reqBody io.Reader
	if resolved.Body != "" {
		reqBody = bytes.NewReader([]byte(resolved.Body))
	}

	checkCtx, cancel := context.WithTimeout(ctx, resolved.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(checkCtx, resolved.Method, resolved.URL, reqBody)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for key, value := range resolved.Headers {
		req.Header.Set(key, value)
	}

	// Execute request
	client := &http.Client{Timeout: resolved.Timeout}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		log.Error("HTTP metric request failed", "url", resolved.URL, "error", err)
		return time.Time{}, nil, err
	}
	defer resp.Body.Close()

	// Read response
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))

	var jsonBody any
	_ = json.Unmarshal(bodyBytes, &jsonBody)

	// Return raw data for evaluation
	data := map[string]any{
		"ok":         resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
		"body":       string(bodyBytes),
		"json":       jsonBody,
		"headers":    resp.Header,
		"duration":   duration.Milliseconds(),
	}

	log.Debug("HTTP metric measurement",
		"url", resolved.URL,
		"status", resp.StatusCode,
		"duration", duration)

	return startTime, data, nil
}

// Resolve resolves Go templates in the config
func Resolve(config *Config, providerCtx *provider.ProviderContext) *Config {
	resolved := &Config{
		URL:     providerCtx.Template(config.URL),
		Method:  config.Method,
		Headers: make(map[string]string),
		Body:    providerCtx.Template(config.Body),
		Timeout: config.Timeout,
	}

	for k, v := range config.Headers {
		resolved.Headers[k] = providerCtx.Template(v)
	}

	return resolved
}
