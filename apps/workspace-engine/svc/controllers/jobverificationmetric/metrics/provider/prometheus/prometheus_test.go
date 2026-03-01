package prometheus

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"
)

func ptr[T any](v T) *T { return &v }

func TestNewPrometheusProvider(t *testing.T) {
	tests := []struct {
		name      string
		config    *Config
		wantErr   bool
		errSubstr string
	}{
		{
			name:   "valid config",
			config: &Config{Address: "http://localhost:9090", Query: "up"},
		},
		{
			name:      "missing address",
			config:    &Config{Query: "up"},
			wantErr:   true,
			errSubstr: "address is required",
		},
		{
			name:      "missing query",
			config:    &Config{Address: "http://localhost:9090"},
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
	config := &Config{Address: "http://prometheus:9090", Query: `up{job="test"}`}

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
	config := &Config{Address: "http://prometheus:9090", Query: "up", Timeout: ptr(int64(45))}

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
	config := &Config{
		Address:    "http://prometheus:9090",
		Query:      "rate(http_requests_total[5m])",
		RangeQuery: &RangeQuery{Step: "1m"},
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
	if !strings.Contains(u, "end="+formatTimestamp(now)) {
		t.Errorf("expected end=now, got URL %s", u)
	}
	if !strings.Contains(u, "start="+formatTimestamp(now.Add(-10*time.Minute))) {
		t.Errorf("expected default start of 10*step (10m) before now, got URL %s", u)
	}
}

func TestBuildQueryURL_RangeQueryWithExplicitStart(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)
	config := &Config{
		Address:    "http://prometheus:9090",
		Query:      "up",
		RangeQuery: &RangeQuery{Step: "15s", Start: ptr("5m")},
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(u, "start="+formatTimestamp(now.Add(-5*time.Minute))) {
		t.Errorf("expected start=5m ago, got URL %s", u)
	}
}

func TestBuildQueryURL_RangeQueryWithExplicitEnd(t *testing.T) {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)
	config := &Config{
		Address:    "http://prometheus:9090",
		Query:      "up",
		RangeQuery: &RangeQuery{Step: "15s", End: ptr("1m")},
	}

	u, err := buildQueryURL(config, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(u, "end="+formatTimestamp(now.Add(-1*time.Minute))) {
		t.Errorf("expected end=1m ago, got URL %s", u)
	}
}

func TestBuildQueryURL_InvalidStep(t *testing.T) {
	config := &Config{Address: "http://prometheus:9090", Query: "up", RangeQuery: &RangeQuery{Step: "invalid"}}
	_, err := buildQueryURL(config, time.Now())
	if err == nil {
		t.Fatal("expected error for invalid step duration")
	}
	if !strings.Contains(err.Error(), "invalid step duration") {
		t.Errorf("expected 'invalid step duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_InvalidStart(t *testing.T) {
	config := &Config{Address: "http://prometheus:9090", Query: "up", RangeQuery: &RangeQuery{Step: "15s", Start: ptr("invalid")}}
	_, err := buildQueryURL(config, time.Now())
	if err == nil {
		t.Fatal("expected error for invalid start duration")
	}
	if !strings.Contains(err.Error(), "invalid start duration") {
		t.Errorf("expected 'invalid start duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_InvalidEnd(t *testing.T) {
	config := &Config{Address: "http://prometheus:9090", Query: "up", RangeQuery: &RangeQuery{Step: "15s", End: ptr("invalid")}}
	_, err := buildQueryURL(config, time.Now())
	if err == nil {
		t.Fatal("expected error for invalid end duration")
	}
	if !strings.Contains(err.Error(), "invalid end duration") {
		t.Errorf("expected 'invalid end duration' error, got %q", err.Error())
	}
}

func TestBuildQueryURL_TrailingSlash(t *testing.T) {
	config := &Config{Address: "http://prometheus:9090/", Query: "up"}
	u, err := buildQueryURL(config, time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(u, "//api") {
		t.Errorf("address trailing slash should be trimmed, got %s", u)
	}
}

func TestSetHeaders_BearerToken(t *testing.T) {
	config := &Config{Authentication: &Authentication{BearerToken: ptr("my-secret-token")}}
	req, _ := http.NewRequest("GET", "http://example.com", nil)
	if err := setHeaders(req, config, http.DefaultClient); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer my-secret-token" {
		t.Errorf("expected Authorization %q, got %q", "Bearer my-secret-token", got)
	}
}

func TestSetHeaders_CustomHeaders(t *testing.T) {
	config := &Config{
		Headers: []Header{
			{Key: "X-Scope-OrgID", Value: "tenant_a"},
			{Key: "X-Custom", Value: "value"},
		},
	}
	req, _ := http.NewRequest("GET", "http://example.com", nil)
	if err := setHeaders(req, config, http.DefaultClient); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := req.Header.Get("X-Scope-OrgID"); got != "tenant_a" {
		t.Errorf("expected X-Scope-OrgID=tenant_a, got %q", got)
	}
	if got := req.Header.Get("X-Custom"); got != "value" {
		t.Errorf("expected X-Custom=value, got %q", got)
	}
}

func TestSetHeaders_NoAuth(t *testing.T) {
	config := &Config{}
	req, _ := http.NewRequest("GET", "http://example.com", nil)
	if err := setHeaders(req, config, http.DefaultClient); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := req.Header.Get("Authorization"); got != "" {
		t.Errorf("expected no Authorization header, got %q", got)
	}
}

func TestBuildHTTPClient_DefaultTimeout(t *testing.T) {
	config := &Config{}
	client := buildHTTPClient(config)
	if client.Timeout != 30*time.Second {
		t.Errorf("expected default 30s timeout, got %v", client.Timeout)
	}
	if client.Transport != nil {
		t.Error("expected nil transport for non-insecure config")
	}
}

func TestBuildHTTPClient_CustomTimeout(t *testing.T) {
	config := &Config{Timeout: ptr(int64(60))}
	client := buildHTTPClient(config)
	if client.Timeout != 60*time.Second {
		t.Errorf("expected 60s timeout, got %v", client.Timeout)
	}
}

func TestBuildHTTPClient_Insecure(t *testing.T) {
	config := &Config{Insecure: ptr(true)}
	client := buildHTTPClient(config)
	if client.Transport == nil {
		t.Fatal("expected transport to be set for insecure config")
	}
}

func TestBuildResultData_VectorSuccess(t *testing.T) {
	body := `{"status":"success","data":{"resultType":"vector","result":[{"metric":{"__name__":"up","job":"prometheus"},"value":[1700000000,"1"]}]}}`
	data, err := buildResultData(200, []byte(body), 50*time.Millisecond)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok, _ := data["ok"].(bool); !ok {
		t.Error("expected ok=true")
	}
	if val, ok := data["value"].(*float64); !ok || val == nil || *val != 1.0 {
		t.Errorf("expected value=1.0, got %v", data["value"])
	}
}

func TestBuildResultData_ErrorResponse(t *testing.T) {
	body := `{"status":"error","errorType":"bad_data","error":"invalid expression"}`
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
}

func TestBuildResultData_InvalidJSON(t *testing.T) {
	_, err := buildResultData(200, []byte("not json"), time.Millisecond)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestResolveProviderTemplates(t *testing.T) {
	token := "{{.variables.token}}"
	config := &Config{
		Address: "http://{{.variables.host}}:9090",
		Query:   `up{job="{{.deployment.name}}"}`,
		Timeout: ptr(int64(30)),
		Authentication: &Authentication{
			BearerToken: &token,
		},
		Headers: []Header{
			{Key: "X-Tenant", Value: "{{.variables.tenant}}"},
		},
	}

	providerCtx := &provider.ProviderContext{
		Deployment: map[string]any{"id": "d1", "name": "api"},
		Variables:  map[string]any{"host": "prometheus.internal", "token": "secret123", "tenant": "org-a"},
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
	if resolved.Headers[0].Value != "org-a" {
		t.Errorf("expected resolved header value, got %s", resolved.Headers[0].Value)
	}
	if *resolved.Timeout != 30 {
		t.Errorf("expected timeout preserved, got %d", *resolved.Timeout)
	}
}

func TestResolveProviderTemplates_NilOptionals(t *testing.T) {
	config := &Config{Address: "http://localhost:9090", Query: "up"}
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
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "success",
			"data": map[string]any{
				"resultType": "vector",
				"result": []map[string]any{
					{"metric": map[string]string{"__name__": "up", "job": "prometheus"}, "value": []any{1700000000, "1"}},
				},
			},
		})
	}))
	defer server.Close()

	p, err := NewPrometheusProvider(&Config{Address: server.URL, Query: `up{job="prometheus"}`})
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

func TestMeasure_ConnectionRefused(t *testing.T) {
	p, _ := NewPrometheusProvider(&Config{Address: "http://localhost:1", Query: "up", Timeout: ptr(int64(1))})
	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err == nil {
		t.Fatal("expected error for connection refused")
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
		{"500ms", 500 * time.Millisecond, false},
		{"", 0, true},
		{"abc", 0, true},
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

func TestParseScalarValue(t *testing.T) {
	tests := []struct {
		name    string
		input   json.RawMessage
		want    float64
		wantErr bool
	}{
		{"quoted string", json.RawMessage(`"1.5"`), 1.5, false},
		{"raw number", json.RawMessage(`1700000000`), 1700000000, false},
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
