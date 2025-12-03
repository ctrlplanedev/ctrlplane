package datadog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/charmbracelet/log"
)

// Ensure Provider implements provider.Provider
var _ provider.Provider = (*Provider)(nil)

// Config contains Datadog metric provider configuration
type Config struct {
	Query  string
	APIKey string
	AppKey string
	Site   string
}

// Provider executes Datadog metrics queries
type Provider struct {
	config *Config
}

// New creates a new Datadog metric provider
func New(config *Config) (*Provider, error) {
	if config.Query == "" {
		return nil, fmt.Errorf("query is required")
	}
	if config.APIKey == "" {
		return nil, fmt.Errorf("apiKey is required")
	}
	if config.AppKey == "" {
		return nil, fmt.Errorf("appKey is required")
	}

	// Set default site
	if config.Site == "" {
		config.Site = "datadoghq.com"
	}

	return &Provider{config: config}, nil
}

// NewFromOAPI creates a new Datadog provider from oapi.DatadogMetricProvider
func NewFromOAPI(oapiProvider any) (*Provider, error) {
	type datadogProvider struct {
		Query  string  `json:"query"`
		APIKey string  `json:"apiKey"`
		AppKey string  `json:"appKey"`
		Site   *string `json:"site,omitempty"`
	}

	data, err := json.Marshal(oapiProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal provider: %w", err)
	}

	var dp datadogProvider
	if err := json.Unmarshal(data, &dp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal provider: %w", err)
	}

	config := &Config{
		Query:  dp.Query,
		APIKey: dp.APIKey,
		AppKey: dp.AppKey,
		Site:   "datadoghq.com",
	}

	if dp.Site != nil && *dp.Site != "" {
		config.Site = *dp.Site
	}

	return New(config)
}

func (p *Provider) Type() string {
	return "datadog"
}

// Measure queries the Datadog Metrics API and returns the result
func (p *Provider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	// Resolve templates in config
	resolved := Resolve(p.config, providerCtx)

	// Build the Datadog API URL
	baseURL := fmt.Sprintf("https://api.%s/api/v2/query/timeseries", resolved.Site)

	// Use current time for the query window (last 5 minutes by default)
	now := time.Now()
	from := now.Add(-5 * time.Minute)

	// Build request body for v2 API
	requestBody := map[string]any{
		"data": map[string]any{
			"type": "timeseries_request",
			"attributes": map[string]any{
				"from": from.UnixMilli(),
				"to":   now.UnixMilli(),
				"queries": []map[string]any{
					{
						"data_source": "metrics",
						"query":       resolved.Query,
						"name":        "query",
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, nil)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set body
	req.Body = io.NopCloser(
		&bytesReader{data: bodyBytes},
	)
	req.ContentLength = int64(len(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	// Set authentication headers
	req.Header.Set("DD-API-KEY", resolved.APIKey)
	req.Header.Set("DD-APPLICATION-KEY", resolved.AppKey)

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		log.Error("Datadog metric request failed", "site", resolved.Site, "error", err)
		return time.Time{}, nil, err
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var jsonResponse map[string]any
	if err := json.Unmarshal(respBody, &jsonResponse); err != nil {
		log.Error("Failed to parse Datadog response", "body", string(respBody), "error", err)
		return time.Time{}, nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Extract the metric value from the response
	value, err := extractMetricValue(jsonResponse)
	if err != nil {
		log.Warn("Could not extract metric value", "error", err)
	}

	// Build result data
	data := map[string]any{
		"ok":         resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
		"body":       string(respBody),
		"json":       jsonResponse,
		"value":      value,
		"duration":   duration.Milliseconds(),
		"query":      resolved.Query,
	}

	log.Debug("Datadog metric measurement",
		"site", resolved.Site,
		"query", resolved.Query,
		"status", resp.StatusCode,
		"value", value,
		"duration", duration)

	return startTime, data, nil
}

// bytesReader is a simple io.Reader wrapper for a byte slice
type bytesReader struct {
	data []byte
	pos  int
}

func (r *bytesReader) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

// Resolve resolves Go templates in the config
func Resolve(config *Config, providerCtx *provider.ProviderContext) *Config {
	return &Config{
		Query:  providerCtx.Template(config.Query),
		APIKey: providerCtx.Template(config.APIKey),
		AppKey: providerCtx.Template(config.AppKey),
		Site:   providerCtx.Template(config.Site),
	}
}

// extractMetricValue extracts the last metric value from a Datadog v2 timeseries response
func extractMetricValue(response map[string]any) (float64, error) {
	data, ok := response["data"].(map[string]any)
	if !ok {
		return 0, fmt.Errorf("missing data field in response")
	}

	attributes, ok := data["attributes"].(map[string]any)
	if !ok {
		return 0, fmt.Errorf("missing attributes field in response")
	}

	series, ok := attributes["series"].([]any)
	if !ok || len(series) == 0 {
		return 0, fmt.Errorf("no series data in response")
	}

	firstSeries, ok := series[0].(map[string]any)
	if !ok {
		return 0, fmt.Errorf("invalid series format")
	}

	// Get the unit information if available
	unit, _ := firstSeries["unit"].([]any)
	_ = unit // Unit info available for future use

	// Get point list - in v2 API, values are under "values"
	// Format: each entry in values corresponds to a timestamp in times
	times, ok := attributes["times"].([]any)
	if !ok || len(times) == 0 {
		return 0, fmt.Errorf("no times in response")
	}

	values, ok := attributes["values"].([]any)
	if !ok || len(values) == 0 {
		return 0, fmt.Errorf("no values in response")
	}

	// Get the first (and typically only) query result
	firstValues, ok := values[0].([]any)
	if !ok || len(firstValues) == 0 {
		return 0, fmt.Errorf("no values for query")
	}

	// Get the last value in the series
	lastValue := firstValues[len(firstValues)-1]

	return toFloat64(lastValue)
}

// toFloat64 converts various numeric types to float64
func toFloat64(v any) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
	case float32:
		return float64(val), nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case json.Number:
		return val.Float64()
	case string:
		return strconv.ParseFloat(val, 64)
	case nil:
		return 0, fmt.Errorf("nil value")
	default:
		return 0, fmt.Errorf("unsupported type: %T", v)
	}
}

// BuildURL constructs the Datadog API URL for metrics query (used for testing)
func BuildURL(site, query string, from, to time.Time) string {
	baseURL := fmt.Sprintf("https://api.%s/api/v1/query", site)
	params := url.Values{}
	params.Set("query", query)
	params.Set("from", strconv.FormatInt(from.Unix(), 10))
	params.Set("to", strconv.FormatInt(to.Unix(), 10))
	return baseURL + "?" + params.Encode()
}
