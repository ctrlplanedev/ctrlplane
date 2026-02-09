package prometheus

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

var _ provider.Provider = (*PrometheusProvider)(nil)

type prometheusResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string          `json:"resultType"`
		Result     json.RawMessage `json:"result"`
	} `json:"data"`
	Error     string `json:"error,omitempty"`
	ErrorType string `json:"errorType,omitempty"`
}

type vectorResult struct {
	Metric map[string]string  `json:"metric"`
	Value  [2]json.RawMessage `json:"value"`
}

type matrixResult struct {
	Metric map[string]string    `json:"metric"`
	Values [][2]json.RawMessage `json:"values"`
}

type PrometheusProvider struct {
	config *oapi.PrometheusMetricProvider
}

func NewPrometheusProvider(config *oapi.PrometheusMetricProvider) (*PrometheusProvider, error) {
	if config.Address == "" {
		return nil, fmt.Errorf("address is required")
	}
	if config.Query == "" {
		return nil, fmt.Errorf("query is required")
	}
	return &PrometheusProvider{config: config}, nil
}

func NewFromOAPI(config oapi.PrometheusMetricProvider) (*PrometheusProvider, error) {
	return NewPrometheusProvider(&config)
}

func (p *PrometheusProvider) Type() string {
	return "prometheus"
}

func (p *PrometheusProvider) Measure(ctx context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	startTime := time.Now()

	resolved := resolveQueryTemplate(p.config, providerCtx)

	reqURL, err := buildQueryURL(resolved, startTime)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to build query URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to create request: %w", err)
	}
	setAuth(req, resolved)

	client := buildHTTPClient(resolved)
	resp, err := client.Do(req)
	duration := time.Since(startTime)
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("prometheus request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("failed to read response: %w", err)
	}

	data, err := buildResultData(resp.StatusCode, respBody, duration)
	if err != nil {
		return time.Time{}, nil, err
	}

	return startTime, data, nil
}

func resolveQueryTemplate(config *oapi.PrometheusMetricProvider, providerCtx *provider.ProviderContext) *oapi.PrometheusMetricProvider {
	resolved := &oapi.PrometheusMetricProvider{
		Address:            providerCtx.Template(config.Address),
		Query:              providerCtx.Template(config.Query),
		Type:               config.Type,
		Step:               config.Step,
		Timeout:            config.Timeout,
		InsecureSkipVerify: config.InsecureSkipVerify,
	}

	if config.BearerToken != nil {
		token := providerCtx.Template(*config.BearerToken)
		resolved.BearerToken = &token
	}

	return resolved
}

func buildQueryURL(config *oapi.PrometheusMetricProvider, now time.Time) (string, error) {
	address := strings.TrimRight(config.Address, "/")
	params := url.Values{}
	params.Set("query", config.Query)

	if config.Timeout != nil {
		params.Set("timeout", *config.Timeout)
	}

	if config.Step != nil && *config.Step != "" {
		params.Set("step", *config.Step)

		step, err := parsePrometheusDuration(*config.Step)
		if err != nil {
			return "", fmt.Errorf("invalid step duration %q: %w", *config.Step, err)
		}
		end := now
		start := end.Add(-step * 10) // look back 10 steps by default

		params.Set("start", formatTimestamp(start))
		params.Set("end", formatTimestamp(end))

		return address + "/api/v1/query_range?" + params.Encode(), nil
	}

	return address + "/api/v1/query?" + params.Encode(), nil
}

func setAuth(req *http.Request, config *oapi.PrometheusMetricProvider) {
	if config.BearerToken != nil && *config.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+*config.BearerToken)
	}
}

func buildHTTPClient(config *oapi.PrometheusMetricProvider) *http.Client {
	timeout := 30 * time.Second
	if config.Timeout != nil {
		if d, err := parsePrometheusDuration(*config.Timeout); err == nil {
			timeout = d
		}
	}

	client := &http.Client{Timeout: timeout}

	if config.InsecureSkipVerify != nil && *config.InsecureSkipVerify {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
		}
	}

	return client
}

func buildResultData(statusCode int, respBody []byte, duration time.Duration) (map[string]any, error) {
	var rawJSON any
	if err := json.Unmarshal(respBody, &rawJSON); err != nil {
		return nil, fmt.Errorf("failed to parse Prometheus response: %w", err)
	}

	var promResp prometheusResponse
	if err := json.Unmarshal(respBody, &promResp); err != nil {
		return nil, fmt.Errorf("failed to parse Prometheus response structure: %w", err)
	}

	data := map[string]any{
		"ok":         statusCode >= 200 && statusCode < 300 && promResp.Status == "success",
		"statusCode": statusCode,
		"body":       string(respBody),
		"json":       rawJSON,
		"duration":   duration.Milliseconds(),
	}

	if promResp.Status != "success" {
		data["error"] = promResp.Error
		data["errorType"] = promResp.ErrorType
		return data, nil
	}

	value, results, err := extractResults(promResp)
	if err != nil {
		return nil, fmt.Errorf("failed to extract Prometheus result values: %w", err)
	}

	data["value"] = value
	data["results"] = results

	return data, nil
}

func extractResults(resp prometheusResponse) (*float64, []map[string]any, error) {
	switch resp.Data.ResultType {
	case "vector":
		return extractVectorResults(resp.Data.Result)
	case "matrix":
		return extractMatrixResults(resp.Data.Result)
	case "scalar":
		return extractScalarResult(resp.Data.Result)
	default:
		return nil, nil, fmt.Errorf("unsupported result type: %s", resp.Data.ResultType)
	}
}

func extractVectorResults(raw json.RawMessage) (*float64, []map[string]any, error) {
	var vectors []vectorResult
	if err := json.Unmarshal(raw, &vectors); err != nil {
		return nil, nil, fmt.Errorf("failed to parse vector result: %w", err)
	}

	if len(vectors) == 0 {
		return nil, nil, nil
	}

	var primary *float64
	results := make([]map[string]any, 0, len(vectors))

	for i, v := range vectors {
		val, err := parseScalarValue(v.Value[1])
		if err != nil {
			return nil, nil, fmt.Errorf("failed to parse vector value: %w", err)
		}
		if i == 0 {
			primary = &val
		}
		results = append(results, map[string]any{
			"metric": v.Metric,
			"value":  val,
		})
	}

	return primary, results, nil
}

func extractMatrixResults(raw json.RawMessage) (*float64, []map[string]any, error) {
	var matrices []matrixResult
	if err := json.Unmarshal(raw, &matrices); err != nil {
		return nil, nil, fmt.Errorf("failed to parse matrix result: %w", err)
	}

	if len(matrices) == 0 {
		return nil, nil, nil
	}

	var primary *float64
	results := make([]map[string]any, 0, len(matrices))

	for i, m := range matrices {
		if len(m.Values) == 0 {
			continue
		}
		lastPair := m.Values[len(m.Values)-1]
		val, err := parseScalarValue(lastPair[1])
		if err != nil {
			return nil, nil, fmt.Errorf("failed to parse matrix value: %w", err)
		}
		if i == 0 {
			primary = &val
		}

		values := make([]map[string]any, 0, len(m.Values))
		for _, pair := range m.Values {
			ts, _ := parseScalarValue(pair[0])
			v, err := parseScalarValue(pair[1])
			if err != nil {
				continue
			}
			values = append(values, map[string]any{
				"timestamp": ts,
				"value":     v,
			})
		}

		results = append(results, map[string]any{
			"metric": m.Metric,
			"value":  val,
			"values": values,
		})
	}

	return primary, results, nil
}

func extractScalarResult(raw json.RawMessage) (*float64, []map[string]any, error) {
	var pair [2]json.RawMessage
	if err := json.Unmarshal(raw, &pair); err != nil {
		return nil, nil, fmt.Errorf("failed to parse scalar result: %w", err)
	}

	val, err := parseScalarValue(pair[1])
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse scalar value: %w", err)
	}

	return &val, []map[string]any{{"value": val}}, nil
}

func parseScalarValue(raw json.RawMessage) (float64, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return strconv.ParseFloat(s, 64)
	}

	var f float64
	if err := json.Unmarshal(raw, &f); err != nil {
		return 0, fmt.Errorf("cannot parse value %q", string(raw))
	}
	return f, nil
}

func parsePrometheusDuration(s string) (time.Duration, error) {
	if len(s) < 2 {
		return 0, fmt.Errorf("duration too short: %q", s)
	}

	unit := s[len(s)-1]
	numStr := s[:len(s)-1]

	num, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid duration number: %w", err)
	}

	switch unit {
	case 's':
		return time.Duration(num * float64(time.Second)), nil
	case 'm':
		return time.Duration(num * float64(time.Minute)), nil
	case 'h':
		return time.Duration(num * float64(time.Hour)), nil
	case 'd':
		return time.Duration(num * 24 * float64(time.Hour)), nil
	default:
		return 0, fmt.Errorf("unknown duration unit: %c", unit)
	}
}

func formatTimestamp(t time.Time) string {
	return strconv.FormatFloat(float64(t.UnixNano())/1e9, 'f', 3, 64)
}
