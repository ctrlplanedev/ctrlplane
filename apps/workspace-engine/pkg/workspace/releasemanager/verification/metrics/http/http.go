package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics"

	"github.com/charmbracelet/log"
)

var _ metrics.Provider = &Provider{}

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

func (p *Provider) Type() string {
	return "http"
}

func (p *Provider) Measure(ctx context.Context, providerCtx *metrics.ProviderContext) (*metrics.Measurement, error) {
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
		return nil, fmt.Errorf("failed to create request: %w", err)
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
		return nil, err
	}
	defer resp.Body.Close()

	// Read response
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))

	var jsonBody any
	json.Unmarshal(bodyBytes, &jsonBody)

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

	return &metrics.Measurement{
		MeasuredAt: startTime,
		Data:       data,
	}, nil
}

// Resolve resolves Go templates in the config
func Resolve(config *Config, providerCtx *metrics.ProviderContext) *Config {
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
