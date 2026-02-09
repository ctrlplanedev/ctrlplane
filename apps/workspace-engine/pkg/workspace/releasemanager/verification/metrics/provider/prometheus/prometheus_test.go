package prometheus

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

func ptr[T any](v T) *T { return &v }

func TestNewPrometheusProvider(t *testing.T) {
	tests := []struct {
		name      string
		config    *oapi.PrometheusMetricProvider
		wantErr   bool
		errSubstr string
	}{
		{
			name:    "valid config",
			config:  &oapi.PrometheusMetricProvider{Address: "http://localhost:9090", Query: "up"},
			wantErr: false,
		},
		{
			name:      "missing address",
			config:    &oapi.PrometheusMetricProvider{Query: "up"},
			wantErr:   true,
			errSubstr: "address is required",
		},
		{
			name:      "missing query",
			config:    &oapi.PrometheusMetricProvider{Address: "http://localhost:9090"},
			wantErr:   true,
			errSubstr: "query is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewPrometheusProvider(tt.config)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got none")
				}
				if !strings.Contains(err.Error(), tt.errSubstr) {
					t.Errorf("expected error containing %q, got %q", tt.errSubstr, err.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if p.Type() != "prometheus" {
				t.Errorf("expected type prometheus, got %s", p.Type())
			}
		})
	}
}

func TestBuildQueryURL_InstantQuery(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   `up{job="test"}`,
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(u, "/api/v1/query?") {
		t.Errorf("expected instant query path, got %s", u)
	}
	if !strings.Contains(u, "query=up") {
		t.Errorf("expected query param, got %s", u)
	}
	if strings.Contains(u, "step=") {
		t.Error("instant query should not have step param")
	}
}

func TestBuildQueryURL_InstantQueryWithTimeout(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		Timeout: ptr(int64(45)),
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(u, "timeout=45s") {
		t.Errorf("expected timeout=45s in URL, got %s", u)
	}
}

func TestBuildQueryURL_RangeQueryDefaults(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "rate(http_requests_total[5m])",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step: "1m",
		},
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(u, "/api/v1/query_range?") {
		t.Errorf("expected range query path, got %s", u)
	}
	if !strings.Contains(u, "step=1m") {
		t.Errorf("expected step=1m, got %s", u)
	}

	expectedEnd := formatTimestamp(now)
	if !strings.Contains(u, "end="+expectedEnd) {
		t.Errorf("expected end=now, got URL %s", u)
	}

	expectedStart := formatTimestamp(now.Add(-10 * time.Minute))
	if !strings.Contains(u, "start="+expectedStart) {
		t.Errorf("expected default start of 10*step (10m) before now, got URL %s", u)
	}
}

func TestBuildQueryURL_RangeQueryWithExplicitStart(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step:  "15s",
			Start: ptr("5m"),
		},
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedStart := formatTimestamp(now.Add(-5 * time.Minute))
	if !strings.Contains(u, "start="+expectedStart) {
		t.Errorf("expected start=5m ago, got URL %s", u)
	}
}

func TestBuildQueryURL_RangeQueryWithExplicitEnd(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step: "15s",
			End:  ptr("1m"),
		},
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedEnd := formatTimestamp(now.Add(-1 * time.Minute))
	if !strings.Contains(u, "end="+expectedEnd) {
		t.Errorf("expected end=1m ago, got URL %s", u)
	}
}

func TestBuildQueryURL_InvalidStep(t *testing.T) {
	now := time.Now()

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step: "invalid",
		},
	}

	_, err := buildQueryURL(config, now)
	if err == nil {
		t.Fatal("expected error for invalid step duration")
	}
	if !strings.Contains(err.Error(), "invalid step duration") {
		t.Errorf("expected 'invalid step duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_InvalidStart(t *testing.T) {
	now := time.Now()

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step:  "15s",
			Start: ptr("invalid"),
		},
	}

	_, err := buildQueryURL(config, now)
	if err == nil {
		t.Fatal("expected error for invalid start duration")
	}
	if !strings.Contains(err.Error(), "invalid start duration") {
		t.Errorf("expected 'invalid start duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_InvalidEnd(t *testing.T) {
	now := time.Now()

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090",
		Query:   "up",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step: "15s",
			End:  ptr("invalid"),
		},
	}

	_, err := buildQueryURL(config, now)
	if err == nil {
		t.Fatal("expected error for invalid end duration")
	}
	if !strings.Contains(err.Error(), "invalid end duration") {
		t.Errorf("expected 'invalid end duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_TrailingSlash(t *testing.T) {
	now := time.Now()

	config := &oapi.PrometheusMetricProvider{
		Address: "http://prometheus:9090/",
		Query:   "up",
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if strings.Contains(u, "//api") {
		t.Errorf("address trailing slash should be trimmed, got %s", u)
	}
}

func TestParsePrometheusDuration(t *testing.T) {
	tests := []struct {
		input   string
		want    time.Duration
		wantErr bool
	}{
		{"15s", 15 * time.Second, false},
		{"1m", 1 * time.Minute, false},
		{"2h", 2 * time.Hour, false},
		{"1d", 24 * time.Hour, false},
		{"1w", 7 * 24 * time.Hour, false},
		{"500ms", 500 * time.Millisecond, false},
		{"1y", 365 * 24 * time.Hour, false},
		{"", 0, true},
		{"abc", 0, true},
		{"10x", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := parsePrometheusDuration(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("parsePrometheusDuration(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestSetHeaders_BearerToken(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{
		Authentication: &prometheusAuth{
			BearerToken: ptr("my-secret-token"),
		},
	}

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	setHeaders(req, config)

	got := req.Header.Get("Authorization")
	want := "Bearer my-secret-token"
	if got != want {
		t.Errorf("expected Authorization %q, got %q", want, got)
	}
}

func TestSetHeaders_CustomHeaders(t *testing.T) {
	headers := []prometheusHeader{
		{Key: "X-Scope-OrgID", Value: "tenant_a"},
		{Key: "X-Custom", Value: "value"},
	}
	config := &oapi.PrometheusMetricProvider{
		Headers: &headers,
	}

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	setHeaders(req, config)

	if got := req.Header.Get("X-Scope-OrgID"); got != "tenant_a" {
		t.Errorf("expected X-Scope-OrgID=tenant_a, got %q", got)
	}
	if got := req.Header.Get("X-Custom"); got != "value" {
		t.Errorf("expected X-Custom=value, got %q", got)
	}
}

func TestSetHeaders_NoAuth(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{}

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	setHeaders(req, config)

	if got := req.Header.Get("Authorization"); got != "" {
		t.Errorf("expected no Authorization header, got %q", got)
	}
}

func TestBuildHTTPClient_DefaultTimeout(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{}
	client := buildHTTPClient(config)

	if client.Timeout != 30*time.Second {
		t.Errorf("expected default 30s timeout, got %v", client.Timeout)
	}
	if client.Transport != nil {
		t.Error("expected nil transport for non-insecure config")
	}
}

func TestBuildHTTPClient_CustomTimeout(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{
		Timeout: ptr(int64(60)),
	}
	client := buildHTTPClient(config)

	if client.Timeout != 60*time.Second {
		t.Errorf("expected 60s timeout, got %v", client.Timeout)
	}
}

func TestBuildHTTPClient_Insecure(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{
		Insecure: ptr(true),
	}
	client := buildHTTPClient(config)

	if client.Transport == nil {
		t.Fatal("expected transport to be set for insecure config")
	}
}

func TestBuildResultData_VectorSuccess(t *testing.T) {
	body := `{
		"status": "success",
		"data": {
			"resultType": "vector",
			"result": [
				{"metric": {"__name__": "up", "job": "prometheus"}, "value": [1700000000, "1"]}
			]
		}
	}`

	data, err := buildResultData(200, []byte(body), 50*time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ok, _ := data["ok"].(bool); !ok {
		t.Error("expected ok=true")
	}
	if sc, _ := data["statusCode"].(int); sc != 200 {
		t.Errorf("expected statusCode=200, got %v", sc)
	}
	if dur, _ := data["duration"].(int64); dur != 50 {
		t.Errorf("expected duration=50, got %v", dur)
	}
	if val, ok := data["value"].(*float64); !ok || val == nil || *val != 1.0 {
		t.Errorf("expected value=1.0, got %v", data["value"])
	}

	results, ok := data["results"].([]map[string]any)
	if !ok || len(results) != 1 {
		t.Fatalf("expected 1 result, got %v", data["results"])
	}
	if results[0]["value"] != 1.0 {
		t.Errorf("expected result value=1.0, got %v", results[0]["value"])
	}
	metric, ok := results[0]["metric"].(map[string]string)
	if !ok {
		t.Fatalf("expected metric to be map[string]string, got %T", results[0]["metric"])
	}
	if metric["job"] != "prometheus" {
		t.Errorf("expected job=prometheus, got %s", metric["job"])
	}
}

func TestBuildResultData_VectorMultipleResults(t *testing.T) {
	body := `{
		"status": "success",
		"data": {
			"resultType": "vector",
			"result": [
				{"metric": {"instance": "a"}, "value": [1700000000, "0.5"]},
				{"metric": {"instance": "b"}, "value": [1700000000, "0.8"]}
			]
		}
	}`

	data, err := buildResultData(200, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	val := data["value"].(*float64)
	if *val != 0.5 {
		t.Errorf("expected primary value=0.5 (first element), got %v", *val)
	}

	results := data["results"].([]map[string]any)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
}

func TestBuildResultData_VectorEmpty(t *testing.T) {
	body := `{
		"status": "success",
		"data": {
			"resultType": "vector",
			"result": []
		}
	}`

	data, err := buildResultData(200, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if val, ok := data["value"].(*float64); ok && val != nil {
		t.Errorf("expected nil value for empty vector, got %v", *val)
	}
}

func TestBuildResultData_MatrixSuccess(t *testing.T) {
	body := `{
		"status": "success",
		"data": {
			"resultType": "matrix",
			"result": [
				{
					"metric": {"job": "prometheus"},
					"values": [
						[1700000000, "0.1"],
						[1700000015, "0.2"],
						[1700000030, "0.3"]
					]
				}
			]
		}
	}`

	data, err := buildResultData(200, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	val := data["value"].(*float64)
	if *val != 0.3 {
		t.Errorf("expected primary value=0.3 (last in series), got %v", *val)
	}

	results := data["results"].([]map[string]any)
	if len(results) != 1 {
		t.Fatalf("expected 1 result series, got %d", len(results))
	}
	if results[0]["value"] != 0.3 {
		t.Errorf("expected series value=0.3, got %v", results[0]["value"])
	}
	values, ok := results[0]["values"].([]map[string]any)
	if !ok {
		t.Fatalf("expected values to be []map[string]any, got %T", results[0]["values"])
	}
	if len(values) != 3 {
		t.Errorf("expected 3 data points, got %d", len(values))
	}
}

func TestBuildResultData_ScalarSuccess(t *testing.T) {
	body := `{
		"status": "success",
		"data": {
			"resultType": "scalar",
			"result": [1700000000, "42.5"]
		}
	}`

	data, err := buildResultData(200, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	val := data["value"].(*float64)
	if *val != 42.5 {
		t.Errorf("expected value=42.5, got %v", *val)
	}
}

func TestBuildResultData_ErrorResponse(t *testing.T) {
	body := `{
		"status": "error",
		"errorType": "bad_data",
		"error": "invalid expression"
	}`

	data, err := buildResultData(400, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ok, _ := data["ok"].(bool); ok {
		t.Error("expected ok=false for error response")
	}
	if data["error"] != "invalid expression" {
		t.Errorf("expected error message, got %v", data["error"])
	}
	if data["errorType"] != "bad_data" {
		t.Errorf("expected errorType=bad_data, got %v", data["errorType"])
	}
}

func TestBuildResultData_Non2xxStatus(t *testing.T) {
	body := `{"status": "success", "data": {"resultType": "vector", "result": []}}`

	data, err := buildResultData(503, []byte(body), time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ok, _ := data["ok"].(bool); ok {
		t.Error("expected ok=false for 503 even with status=success")
	}
	if sc, _ := data["statusCode"].(int); sc != 503 {
		t.Errorf("expected statusCode=503, got %v", sc)
	}
}

func TestBuildResultData_InvalidJSON(t *testing.T) {
	_, err := buildResultData(200, []byte("not json"), time.Millisecond)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestBuildResultData_DataContract(t *testing.T) {
	body := `{
		"status": "success",
		"data": {"resultType": "vector", "result": [{"metric": {}, "value": [1700000000, "1"]}]}
	}`

	data, err := buildResultData(200, []byte(body), 123*time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	requiredKeys := []string{"ok", "statusCode", "body", "json", "duration", "value", "results"}
	for _, key := range requiredKeys {
		if _, exists := data[key]; !exists {
			t.Errorf("missing required key %q in data map", key)
		}
	}

	if _, ok := data["ok"].(bool); !ok {
		t.Errorf("ok should be bool, got %T", data["ok"])
	}
	if _, ok := data["statusCode"].(int); !ok {
		t.Errorf("statusCode should be int, got %T", data["statusCode"])
	}
	if _, ok := data["body"].(string); !ok {
		t.Errorf("body should be string, got %T", data["body"])
	}
	if _, ok := data["duration"].(int64); !ok {
		t.Errorf("duration should be int64, got %T", data["duration"])
	}
	if data["duration"].(int64) != 123 {
		t.Errorf("expected duration=123, got %v", data["duration"])
	}
}

func TestResolveProviderTemplates(t *testing.T) {
	token := "{{.variables.token}}"
	config := &oapi.PrometheusMetricProvider{
		Address: "http://{{.variables.host}}:9090",
		Query:   `up{job="{{.deployment.name}}"}`,
		Timeout: ptr(int64(30)),
		Authentication: &prometheusAuth{
			BearerToken: &token,
		},
		Headers: &[]prometheusHeader{
			{Key: "X-Tenant", Value: "{{.variables.tenant}}"},
		},
	}

	providerCtx := &provider.ProviderContext{
		Deployment: &oapi.Deployment{
			Id:       "d1",
			Name:     "api",
			Slug:     "api",
			SystemId: "s1",
		},
		Variables: map[string]any{
			"host":   "prometheus.internal",
			"token":  "secret123",
			"tenant": "org-a",
		},
	}

	resolved := resolveProviderTemplates(config, providerCtx)

	if resolved.Address != "http://prometheus.internal:9090" {
		t.Errorf("expected resolved address, got %s", resolved.Address)
	}
	if resolved.Query != `up{job="api"}` {
		t.Errorf("expected resolved query, got %s", resolved.Query)
	}
	if *resolved.Authentication.BearerToken != "secret123" {
		t.Errorf("expected resolved bearer token, got %s", *resolved.Authentication.BearerToken)
	}
	if (*resolved.Headers)[0].Value != "org-a" {
		t.Errorf("expected resolved header value, got %s", (*resolved.Headers)[0].Value)
	}
	if *resolved.Timeout != 30 {
		t.Errorf("expected timeout preserved, got %d", *resolved.Timeout)
	}
}

func TestResolveProviderTemplates_NilOptionals(t *testing.T) {
	config := &oapi.PrometheusMetricProvider{
		Address: "http://localhost:9090",
		Query:   "up",
	}

	resolved := resolveProviderTemplates(config, &provider.ProviderContext{})

	if resolved.Headers != nil {
		t.Error("expected nil headers when input is nil")
	}
	if resolved.Authentication != nil {
		t.Error("expected nil authentication when input is nil")
	}
}

func TestMeasure_InstantQueryE2E(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/api/v1/query") {
			t.Errorf("expected /api/v1/query path, got %s", r.URL.Path)
		}
		if strings.Contains(r.URL.Path, "query_range") {
			t.Error("expected instant query, got range query")
		}
		if r.URL.Query().Get("query") != `up{job="prometheus"}` {
			t.Errorf("unexpected query param: %s", r.URL.Query().Get("query"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "success",
			"data": map[string]any{
				"resultType": "vector",
				"result": []map[string]any{
					{
						"metric": map[string]string{"__name__": "up", "job": "prometheus"},
						"value":  []any{1700000000, "1"},
					},
				},
			},
		})
	}))
	defer server.Close()

	p, err := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: server.URL,
		Query:   `up{job="prometheus"}`,
		Type:    "prometheus",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	measuredAt, data, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if measuredAt.IsZero() {
		t.Error("expected non-zero measuredAt")
	}
	if ok, _ := data["ok"].(bool); !ok {
		t.Error("expected ok=true")
	}
	if val, ok := data["value"].(*float64); !ok || *val != 1.0 {
		t.Errorf("expected value=1.0, got %v", data["value"])
	}
}

func TestMeasure_RangeQueryE2E(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/api/v1/query_range") {
			t.Errorf("expected /api/v1/query_range path, got %s", r.URL.Path)
		}
		if r.URL.Query().Get("step") != "15s" {
			t.Errorf("expected step=15s, got %s", r.URL.Query().Get("step"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "success",
			"data": map[string]any{
				"resultType": "matrix",
				"result": []map[string]any{
					{
						"metric": map[string]string{"job": "test"},
						"values": [][]any{
							{1700000000, "0.1"},
							{1700000015, "0.2"},
						},
					},
				},
			},
		})
	}))
	defer server.Close()

	p, err := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: server.URL,
		Query:   "rate(requests[5m])",
		Type:    "prometheus",
		RangeQuery: &struct {
			End   *string `json:"end,omitempty"`
			Start *string `json:"start,omitempty"`
			Step  string  `json:"step"`
		}{
			Step: "15s",
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, data, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	val := data["value"].(*float64)
	if *val != 0.2 {
		t.Errorf("expected last matrix value=0.2, got %v", *val)
	}
}

func TestMeasure_BearerTokenSent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-token" {
			t.Errorf("expected Bearer test-token, got %q", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}))
	defer server.Close()

	token := "test-token"
	p, _ := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: server.URL,
		Query:   "up",
		Type:    "prometheus",
		Authentication: &prometheusAuth{
			BearerToken: &token,
		},
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMeasure_CustomHeadersSent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-Scope-OrgID"); got != "tenant_a" {
			t.Errorf("expected X-Scope-OrgID=tenant_a, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}))
	defer server.Close()

	headers := []prometheusHeader{{Key: "X-Scope-OrgID", Value: "tenant_a"}}
	p, _ := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: server.URL,
		Query:   "up",
		Type:    "prometheus",
		Headers: &headers,
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMeasure_PrometheusError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(422)
		_, _ = w.Write([]byte(`{"status":"error","errorType":"bad_data","error":"invalid query"}`))
	}))
	defer server.Close()

	p, _ := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: server.URL,
		Query:   "invalid{",
		Type:    "prometheus",
	})

	_, data, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ok, _ := data["ok"].(bool); ok {
		t.Error("expected ok=false for error response")
	}
	if data["error"] != "invalid query" {
		t.Errorf("expected error field, got %v", data["error"])
	}
}

func TestMeasure_ConnectionRefused(t *testing.T) {
	p, _ := NewPrometheusProvider(&oapi.PrometheusMetricProvider{
		Address: "http://localhost:1",
		Query:   "up",
		Type:    "prometheus",
		Timeout: ptr(int64(1)),
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err == nil {
		t.Fatal("expected error for connection refused")
	}
}

func TestParseScalarValue(t *testing.T) {
	tests := []struct {
		name    string
		input   json.RawMessage
		want    float64
		wantErr bool
	}{
		{"quoted string", json.RawMessage(`"1.5"`), 1.5, false},
		{"quoted integer", json.RawMessage(`"42"`), 42.0, false},
		{"raw number", json.RawMessage(`1700000000`), 1700000000, false},
		{"quoted zero", json.RawMessage(`"0"`), 0, false},
		{"invalid", json.RawMessage(`"not_a_number"`), 0, true},
		{"null", json.RawMessage(`null`), 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseScalarValue(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("parseScalarValue() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFormatTimestamp(t *testing.T) {
	ts := time.Date(2026, 2, 9, 12, 0, 0, 500000000, time.UTC)
	got := formatTimestamp(ts)

	if !strings.Contains(got, ".") {
		t.Errorf("expected sub-second precision, got %s", got)
	}

	val, err := parseScalarValue(json.RawMessage(got))
	if err != nil {
		t.Fatalf("formatTimestamp output should be parseable: %v", err)
	}
	if val < 1e9 {
		t.Errorf("expected unix timestamp, got %v", val)
	}
}
