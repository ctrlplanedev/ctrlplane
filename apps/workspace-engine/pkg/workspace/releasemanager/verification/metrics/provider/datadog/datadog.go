package datadog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"strconv"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/charmbracelet/log"
)

// Ensure Provider implements provider.Provider
var _ provider.Provider = (*Provider)(nil)

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

// Config contains Datadog metric provider configuration
type Config struct {
	Query           string
	IntervalSeconds int64
	Queries         map[string]string
	Aggregator      string
	Formula         string
	APIKey          string
	AppKey          string
	Site            string
}

// Provider executes Datadog metrics queries
type Provider struct {
	config *oapi.DatadogMetricProvider
}

// New creates a new Datadog metric provider
func New(config *oapi.DatadogMetricProvider) (*Provider, error) {
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

	fmt.Printf("Datadog provider interval configured as: %d seconds\n", *config.IntervalSeconds)

	if config.Aggregator == nil || *config.Aggregator == "" {
		aggregator := oapi.DatadogMetricProviderAggregator("last")
		config.Aggregator = &aggregator
	}

	// Set default site
	if config.Site == nil || *config.Site == "" {
		site := "datadoghq.com"
		config.Site = &site
	}

	return &Provider{config: config}, nil
}

// NewFromOAPI creates a new Datadog provider from oapi.DatadogMetricProvider
func NewFromOAPI(config oapi.DatadogMetricProvider) (*Provider, error) {
	return New(&config)
}

func (p *Provider) Type() string {
	return "datadog"
}

// Measure queries the Datadog Metrics API and returns the result
func (p *Provider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	// Resolve templates in config
	resolved := Resolve(p.config, providerCtx)

	aggregator := "latest"
	if p.config.Aggregator != nil {
		aggregator = string(*resolved.Aggregator)
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

	// Build the Datadog API URL
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

	// Build request body for v2 API
	requestBody := map[string]any{
		"data": map[string]any{
			"type": "scalar_request",
			"attributes": map[string]any{
				// Datadog requires milliseconds for v2 api
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

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, nil)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set body
	req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	req.ContentLength = int64(len(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	// Set authentication headers
	req.Header.Set("DD-API-KEY", resolved.ApiKey)
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

	var rawJson any
	if err := json.Unmarshal(respBody, &rawJson); err != nil {
		log.Error("Failed to parse Datadog response", "body", string(respBody), "error", err)
		return time.Time{}, nil, fmt.Errorf("failed to parse response: %w", err)
	}
	// Parse response
	var jsonResponse datadogResponseV2
	if err := json.Unmarshal(respBody, &jsonResponse); err != nil {
		log.Error("Failed to parse Datadog response", "body", string(respBody), "error", err)
		return time.Time{}, nil, fmt.Errorf("failed to parse response: %w", err)
	}

	queries, err := extractQueryValue(jsonResponse)
	if err != nil {
		log.Warn("Could not extract query values", "error", err)
	}

	// Build result data
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
func Resolve(config *oapi.DatadogMetricProvider, providerCtx *provider.ProviderContext) *oapi.DatadogMetricProvider {
	resolved := &oapi.DatadogMetricProvider{
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

// // toFloat64 converts various numeric types to float64
// func toFloat64(v any) (float64, error) {
// 	switch val := v.(type) {
// 	case float64:
// 		return val, nil
// 	case float32:
// 		return float64(val), nil
// 	case int:
// 		return float64(val), nil
// 	case int64:
// 		return float64(val), nil
// 	case json.Number:
// 		return val.Float64()
// 	case string:
// 		return strconv.ParseFloat(val, 64)
// 	case nil:
// 		return 0, fmt.Errorf("nil value")
// 	default:
// 		return 0, fmt.Errorf("unsupported type: %T", v)
// 	}
// }

// BuildURL constructs the Datadog API URL for metrics query (used for testing)
func BuildURL(site, query string, from, to time.Time) string {
	baseURL := fmt.Sprintf("https://api.%s/api/v1/query", site)
	params := url.Values{}
	params.Set("query", query)
	params.Set("from", strconv.FormatInt(from.Unix(), 10))
	params.Set("to", strconv.FormatInt(to.Unix(), 10))
	return baseURL + "?" + params.Encode()
}
