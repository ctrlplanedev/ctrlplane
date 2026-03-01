package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/charmbracelet/log"
)

var _ provider.Provider = (*Provider)(nil)

type Config struct {
	URL     string
	Method  string
	Headers map[string]string
	Body    string
	Timeout time.Duration
}

type Provider struct {
	config *Config
}

type jsonConfig struct {
	URL     string             `json:"url"`
	Method  *string            `json:"method,omitempty"`
	Headers *map[string]string `json:"headers,omitempty"`
	Body    *string            `json:"body,omitempty"`
	Timeout *string            `json:"timeout,omitempty"`
}

func New(config *Config) (*Provider, error) {
	if config.Method == "" {
		config.Method = "GET"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	return &Provider{config: config}, nil
}

func NewFromJSON(data json.RawMessage) (*Provider, error) {
	var jc jsonConfig
	if err := json.Unmarshal(data, &jc); err != nil {
		return nil, fmt.Errorf("failed to unmarshal HTTP provider: %w", err)
	}

	config := &Config{
		URL:     jc.URL,
		Method:  "GET",
		Headers: make(map[string]string),
		Timeout: 30 * time.Second,
	}

	if jc.Method != nil {
		config.Method = *jc.Method
	}
	if jc.Headers != nil {
		config.Headers = *jc.Headers
	}
	if jc.Body != nil {
		config.Body = *jc.Body
	}
	if jc.Timeout != nil {
		timeout, err := time.ParseDuration(*jc.Timeout)
		if err != nil {
			return nil, fmt.Errorf("invalid timeout: %w", err)
		}
		config.Timeout = timeout
	}

	return New(config)
}

func (p *Provider) Type() string { return "http" }

func (p *Provider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()
	resolved := Resolve(p.config, providerCtx)

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

	for key, value := range resolved.Headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: resolved.Timeout}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		log.Error("HTTP metric request failed", "url", resolved.URL, "error", err)
		return time.Time{}, nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))

	var jsonBody any
	_ = json.Unmarshal(bodyBytes, &jsonBody)

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
