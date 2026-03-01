package datadog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/charmbracelet/log"
)

var _ provider.Provider = (*Provider)(nil)

type Config struct {
	ApiKey          string            `json:"apiKey"`
	AppKey          string            `json:"appKey"`
	Queries         map[string]string `json:"queries"`
	Aggregator      *string           `json:"aggregator,omitempty"`
	Formula         *string           `json:"formula,omitempty"`
	IntervalSeconds *int64            `json:"intervalSeconds,omitempty"`
	Site            *string           `json:"site,omitempty"`
}

type datadogResponseV2 struct {
	Data struct {
		Attributes struct {
			Columns []struct {
				Name   string
				Values []*float64
			}
		}
		Errors string
	}
}

var unixNow = func() int64 { return time.Now().Unix() }

type Provider struct {
	config *Config
}

func New(config *Config) (*Provider, error) {
	if config.ApiKey == "" {
		return nil, fmt.Errorf("apiKey is required")
	}
	if config.AppKey == "" {
		return nil, fmt.Errorf("appKey is required")
	}

	if config.IntervalSeconds == nil || *config.IntervalSeconds == 0 {
		interval := int64(5 * 60)
		config.IntervalSeconds = &interval
	}

	if config.Aggregator == nil || *config.Aggregator == "" {
		agg := "last"
		config.Aggregator = &agg
	}

	if config.Site == nil || *config.Site == "" {
		site := "datadoghq.com"
		config.Site = &site
	}

	return &Provider{config: config}, nil
}

func NewFromJSON(data json.RawMessage) (*Provider, error) {
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("failed to unmarshal Datadog provider: %w", err)
	}
	return New(&c)
}

func (p *Provider) Type() string { return "datadog" }

func (p *Provider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	resolved := Resolve(p.config, providerCtx)

	aggregator := "latest"
	if p.config.Aggregator != nil {
		aggregator = *resolved.Aggregator
	}

	site := "datadoghq.com"
	if resolved.Site != nil {
		site = *resolved.Site
	}

	interval := int64(5 * 60)
	if p.config.IntervalSeconds != nil {
		interval = *p.config.IntervalSeconds
	}

	formulas := []map[string]string{}
	if p.config.Formula != nil {
		formulas = append(formulas, map[string]string{
			"formula": *resolved.Formula,
		})
	}

	baseURL := fmt.Sprintf("https://api.%s/api/v2/query/scalar", site)

	now := unixNow()
	qp := make([]map[string]string, 0, len(resolved.Queries))
	for k, v := range resolved.Queries {
		p := map[string]string{
			"aggregator":  aggregator,
			"data_source": "metrics",
			"name":        k,
			"query":       v,
		}
		qp = append(qp, p)
	}

	requestBody := map[string]any{
		"data": map[string]any{
			"type": "scalar_request",
			"attributes": map[string]any{
				"from":     (now - interval) * 1000,
				"to":       now * 1000,
				"queries":  qp,
				"formulas": formulas,
			},
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, nil)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	req.ContentLength = int64(len(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("DD-API-KEY", resolved.ApiKey)
	req.Header.Set("DD-APPLICATION-KEY", resolved.AppKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		log.Error("Datadog metric request failed", "site", resolved.Site, "error", err)
		return time.Time{}, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to read response: %w", err)
	}

	var rawJson any
	if err := json.Unmarshal(respBody, &rawJson); err != nil {
		log.Error("Failed to parse Datadog response", "body", string(respBody), "error", err)
		return time.Time{}, nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var jsonResponse datadogResponseV2
	if err := json.Unmarshal(respBody, &jsonResponse); err != nil {
		log.Error("Failed to parse Datadog response", "body", string(respBody), "error", err)
		return time.Time{}, nil, fmt.Errorf("failed to parse response: %w", err)
	}

	queries, err := extractQueryValue(jsonResponse)
	if err != nil {
		log.Warn("Could not extract query values", "error", err)
	}

	data := map[string]any{
		"ok":         resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
		"body":       string(respBody),
		"json":       rawJson,
		"duration":   duration.Milliseconds(),
		"queries":    queries,
	}

	log.Debug("Datadog metric measurement",
		"site", resolved.Site,
		"status", resp.StatusCode,
		"duration", duration)

	return startTime, data, nil
}

func Resolve(config *Config, providerCtx *provider.ProviderContext) *Config {
	resolved := &Config{
		ApiKey:     providerCtx.Template(config.ApiKey),
		AppKey:     providerCtx.Template(config.AppKey),
		Aggregator: config.Aggregator,
	}

	if config.Queries != nil {
		queries := make(map[string]string)
		for k, v := range config.Queries {
			queries[k] = providerCtx.Template(v)
		}
		resolved.Queries = queries
	}

	if config.Site != nil {
		site := providerCtx.Template(*config.Site)
		resolved.Site = &site
	}

	if config.Formula != nil {
		formula := providerCtx.Template(*config.Formula)
		resolved.Formula = &formula
	}

	return resolved
}

func isEmptyResponse(response datadogResponseV2) bool {
	return reflect.ValueOf(response.Data.Attributes).IsZero() ||
		len(response.Data.Attributes.Columns) == 0
}

func extractQueryValue(response datadogResponseV2) (map[string]*float64, error) {
	if isEmptyResponse(response) {
		return nil, fmt.Errorf("empty response")
	}

	values := make(map[string]*float64)
	for _, column := range response.Data.Attributes.Columns {
		if len(column.Values) == 0 {
			values[column.Name] = nil
			continue
		}
		values[column.Name] = column.Values[0]
	}

	return values, nil
}
