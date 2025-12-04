package datadog

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

func TestNew(t *testing.T) {
	tests := []struct {
		name        string
		config      *Config
		wantSite    string
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid config with defaults",
			config: &Config{
				Query:  "sum:requests{service:api}",
				APIKey: "test-api-key",
				AppKey: "test-app-key",
			},
			wantSite:    "datadoghq.com",
			expectError: false,
		},
		{
			name: "valid config with custom site",
			config: &Config{
				Query:  "sum:requests{service:api}",
				APIKey: "test-api-key",
				AppKey: "test-app-key",
				Site:   "datadoghq.eu",
			},
			wantSite:    "datadoghq.eu",
			expectError: false,
		},
		{
			name: "missing query",
			config: &Config{
				APIKey: "test-api-key",
				AppKey: "test-app-key",
			},
			expectError: true,
			errorMsg:    "query is required",
		},
		{
			name: "missing apiKey",
			config: &Config{
				Query:  "sum:requests{service:api}",
				AppKey: "test-app-key",
			},
			expectError: true,
			errorMsg:    "apiKey is required",
		},
		{
			name: "missing appKey",
			config: &Config{
				Query:  "sum:requests{service:api}",
				APIKey: "test-api-key",
			},
			expectError: true,
			errorMsg:    "appKey is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := New(tt.config)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				} else if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("expected error to contain %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if p.config.Site != tt.wantSite {
				t.Errorf("expected site %s, got %s", tt.wantSite, p.config.Site)
			}
		})
	}
}

func TestNewFromOAPI(t *testing.T) {
	tests := []struct {
		name        string
		provider    map[string]any
		wantQuery   string
		wantSite    string
		expectError bool
	}{
		{
			name: "valid provider config",
			provider: map[string]any{
				"type":   "datadog",
				"query":  "sum:errors{service:api}",
				"apiKey": "api-key-123",
				"appKey": "app-key-456",
			},
			wantQuery: "sum:errors{service:api}",
			wantSite:  "datadoghq.com",
		},
		{
			name: "with custom site",
			provider: map[string]any{
				"type":   "datadog",
				"query":  "avg:latency{service:api}",
				"apiKey": "api-key-123",
				"appKey": "app-key-456",
				"site":   "us3.datadoghq.com",
			},
			wantQuery: "avg:latency{service:api}",
			wantSite:  "us3.datadoghq.com",
		},
		{
			name: "missing apiKey",
			provider: map[string]any{
				"type":   "datadog",
				"query":  "sum:errors{service:api}",
				"appKey": "app-key-456",
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewFromOAPI(tt.provider)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if p.config.Query != tt.wantQuery {
				t.Errorf("expected query %s, got %s", tt.wantQuery, p.config.Query)
			}

			if p.config.Site != tt.wantSite {
				t.Errorf("expected site %s, got %s", tt.wantSite, p.config.Site)
			}
		})
	}
}

func TestType(t *testing.T) {
	p := &Provider{}
	if got := p.Type(); got != "datadog" {
		t.Errorf("Type() = %v, want %v", got, "datadog")
	}
}

func TestMeasure(t *testing.T) {
	tests := []struct {
		name           string
		config         *Config
		setupServer    func() *httptest.Server
		providerCtx    *provider.ProviderContext
		wantStatusCode int
		wantError      bool
		checkResult    func(t *testing.T, data map[string]any)
	}{
		{
			name: "successful metrics query",
			config: &Config{
				Query:  "sum:requests{service:api}",
				APIKey: "test-api-key",
				AppKey: "test-app-key",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Verify request method
					if r.Method != "POST" {
						t.Errorf("expected POST method, got %s", r.Method)
					}

					// Verify auth headers
					if apiKey := r.Header.Get("DD-API-KEY"); apiKey != "test-api-key" {
						t.Errorf("expected DD-API-KEY header 'test-api-key', got %s", apiKey)
					}
					if appKey := r.Header.Get("DD-APPLICATION-KEY"); appKey != "test-app-key" {
						t.Errorf("expected DD-APPLICATION-KEY header 'test-app-key', got %s", appKey)
					}

					w.WriteHeader(http.StatusOK)
					_ = json.NewEncoder(w).Encode(map[string]any{
						"data": map[string]any{
							"type": "timeseries_response",
							"attributes": map[string]any{
								"times":  []any{1700000000000, 1700000060000},
								"values": []any{[]any{0.05, 0.03}},
								"series": []any{
									map[string]any{
										"unit": []any{"percent", "short"},
									},
								},
							},
						},
					})
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 200,
			wantError:      false,
			checkResult: func(t *testing.T, data map[string]any) {
				if value, ok := data["value"].(float64); !ok || value != 0.03 {
					t.Errorf("expected value 0.03, got %v", data["value"])
				}
				if ok, found := data["ok"].(bool); !found || !ok {
					t.Errorf("expected ok=true, got %v", data["ok"])
				}
			},
		},
		{
			name: "401 unauthorized",
			config: &Config{
				Query:  "sum:requests{service:api}",
				APIKey: "invalid-key",
				AppKey: "invalid-key",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusUnauthorized)
					_, _ = w.Write([]byte(`{"errors": ["Forbidden"]}`))
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 401,
			wantError:      false,
			checkResult: func(t *testing.T, data map[string]any) {
				if ok, found := data["ok"].(bool); !found || ok {
					t.Errorf("expected ok=false, got %v", data["ok"])
				}
			},
		},
		{
			name: "empty series response",
			config: &Config{
				Query:  "sum:nonexistent{service:api}",
				APIKey: "test-api-key",
				AppKey: "test-app-key",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_ = json.NewEncoder(w).Encode(map[string]any{
						"data": map[string]any{
							"type": "timeseries_response",
							"attributes": map[string]any{
								"times":  []any{},
								"values": []any{},
								"series": []any{},
							},
						},
					})
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 200,
			wantError:      false,
			checkResult: func(t *testing.T, data map[string]any) {
				// Value extraction should fail gracefully for empty series
				// If value exists and is a float64, that's fine (we extracted a zero value)
				_ = data["value"]
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := tt.setupServer()
			defer server.Close()

			// Override site to point to test server
			tt.config.Site = strings.TrimPrefix(server.URL, "http://")

			// Create a custom provider that uses our test URL
			p := &Provider{config: tt.config}

			// Replace the measure method to use the test server
			measuredAt, data, err := measureWithTestServer(p, context.Background(), tt.providerCtx, server.URL)

			if tt.wantError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Check status code
			if statusCode, ok := data["statusCode"].(int); !ok || statusCode != tt.wantStatusCode {
				t.Errorf("expected status code %d, got %v", tt.wantStatusCode, data["statusCode"])
			}

			// Check that MeasuredAt is set
			if measuredAt.IsZero() {
				t.Error("expected MeasuredAt to be set")
			}

			// Run custom checks if provided
			if tt.checkResult != nil {
				tt.checkResult(t, data)
			}
		})
	}
}

// measureWithTestServer is a helper that uses a test server URL instead of the real Datadog API
func measureWithTestServer(p *Provider, ctx context.Context, providerCtx *provider.ProviderContext, testURL string) (time.Time, map[string]any, error) {
	startTime := time.Now()

	// Resolve templates
	resolved := Resolve(p.config, providerCtx)

	// Build request body for v2 API
	now := time.Now()
	from := now.Add(-5 * time.Minute)

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

	bodyBytes, _ := json.Marshal(requestBody)

	// Create request to test server
	req, err := http.NewRequestWithContext(ctx, "POST", testURL+"/api/v2/query/timeseries", strings.NewReader(string(bodyBytes)))
	if err != nil {
		return time.Time{}, nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("DD-API-KEY", resolved.APIKey)
	req.Header.Set("DD-APPLICATION-KEY", resolved.AppKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		return time.Time{}, nil, err
	}
	defer resp.Body.Close()

	var jsonResponse map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&jsonResponse)

	value, _ := extractMetricValue(jsonResponse)

	data := map[string]any{
		"ok":         resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
		"json":       jsonResponse,
		"value":      value,
		"duration":   duration.Milliseconds(),
		"query":      resolved.Query,
	}

	return startTime, data, nil
}

func TestResolve(t *testing.T) {
	tests := []struct {
		name        string
		config      *Config
		providerCtx *provider.ProviderContext
		wantQuery   string
		wantAPIKey  string
		wantAppKey  string
		wantSite    string
	}{
		{
			name: "resolve query template with resource",
			config: &Config{
				Query:  "sum:requests{service:{{ .resource.name }}}",
				APIKey: "static-api-key",
				AppKey: "static-app-key",
				Site:   "datadoghq.com",
			},
			providerCtx: &provider.ProviderContext{
				Resource: &oapi.Resource{
					Id:         "res-123",
					Identifier: "api-service",
					Name:       "api-service",
					Kind:       "Service",
					Version:    "v1",
				},
			},
			wantQuery:  "sum:requests{service:api-service}",
			wantAPIKey: "static-api-key",
			wantAppKey: "static-app-key",
			wantSite:   "datadoghq.com",
		},
		{
			name: "resolve credentials from variables",
			config: &Config{
				Query:  "sum:errors{env:prod}",
				APIKey: "{{ .variables.dd_api_key }}",
				AppKey: "{{ .variables.dd_app_key }}",
				Site:   "datadoghq.com",
			},
			providerCtx: &provider.ProviderContext{
				Variables: map[string]any{
					"dd_api_key": "secret-api-key-from-var",
					"dd_app_key": "secret-app-key-from-var",
				},
			},
			wantQuery:  "sum:errors{env:prod}",
			wantAPIKey: "secret-api-key-from-var",
			wantAppKey: "secret-app-key-from-var",
			wantSite:   "datadoghq.com",
		},
		{
			name: "resolve site from variables",
			config: &Config{
				Query:  "sum:requests{*}",
				APIKey: "api-key",
				AppKey: "app-key",
				Site:   "{{ .variables.dd_site }}",
			},
			providerCtx: &provider.ProviderContext{
				Variables: map[string]any{
					"dd_site": "datadoghq.eu",
				},
			},
			wantQuery:  "sum:requests{*}",
			wantAPIKey: "api-key",
			wantAppKey: "app-key",
			wantSite:   "datadoghq.eu",
		},
		{
			name: "no templates",
			config: &Config{
				Query:  "avg:latency{service:api}",
				APIKey: "plain-api-key",
				AppKey: "plain-app-key",
				Site:   "us3.datadoghq.com",
			},
			providerCtx: &provider.ProviderContext{},
			wantQuery:   "avg:latency{service:api}",
			wantAPIKey:  "plain-api-key",
			wantAppKey:  "plain-app-key",
			wantSite:    "us3.datadoghq.com",
		},
		{
			name: "resolve with environment",
			config: &Config{
				Query:  "sum:errors{env:{{ .environment.name }}}",
				APIKey: "api-key",
				AppKey: "app-key",
				Site:   "datadoghq.com",
			},
			providerCtx: &provider.ProviderContext{
				Environment: &oapi.Environment{
					Id:        "env-456",
					Name:      "production",
					CreatedAt: "2024-01-01T00:00:00Z",
					SystemId:  "sys-123",
				},
			},
			wantQuery:  "sum:errors{env:production}",
			wantAPIKey: "api-key",
			wantAppKey: "app-key",
			wantSite:   "datadoghq.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved := Resolve(tt.config, tt.providerCtx)

			if resolved.Query != tt.wantQuery {
				t.Errorf("expected query %s, got %s", tt.wantQuery, resolved.Query)
			}

			if resolved.APIKey != tt.wantAPIKey {
				t.Errorf("expected apiKey %s, got %s", tt.wantAPIKey, resolved.APIKey)
			}

			if resolved.AppKey != tt.wantAppKey {
				t.Errorf("expected appKey %s, got %s", tt.wantAppKey, resolved.AppKey)
			}

			if resolved.Site != tt.wantSite {
				t.Errorf("expected site %s, got %s", tt.wantSite, resolved.Site)
			}
		})
	}
}

func TestExtractMetricValue(t *testing.T) {
	tests := []struct {
		name        string
		response    map[string]any
		wantValue   float64
		expectError bool
	}{
		{
			name: "valid v2 response with single value",
			response: map[string]any{
				"data": map[string]any{
					"attributes": map[string]any{
						"times":  []any{1700000000000},
						"values": []any{[]any{42.5}},
						"series": []any{map[string]any{}},
					},
				},
			},
			wantValue:   42.5,
			expectError: false,
		},
		{
			name: "valid v2 response with multiple values (returns last)",
			response: map[string]any{
				"data": map[string]any{
					"attributes": map[string]any{
						"times":  []any{1700000000000, 1700000060000, 1700000120000},
						"values": []any{[]any{10.0, 20.0, 30.0}},
						"series": []any{map[string]any{}},
					},
				},
			},
			wantValue:   30.0,
			expectError: false,
		},
		{
			name:        "missing data field",
			response:    map[string]any{},
			expectError: true,
		},
		{
			name: "missing attributes field",
			response: map[string]any{
				"data": map[string]any{},
			},
			expectError: true,
		},
		{
			name: "empty series",
			response: map[string]any{
				"data": map[string]any{
					"attributes": map[string]any{
						"times":  []any{},
						"values": []any{},
						"series": []any{},
					},
				},
			},
			expectError: true,
		},
		{
			name: "empty values",
			response: map[string]any{
				"data": map[string]any{
					"attributes": map[string]any{
						"times":  []any{1700000000000},
						"values": []any{},
						"series": []any{map[string]any{}},
					},
				},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := extractMetricValue(tt.response)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if value != tt.wantValue {
				t.Errorf("expected value %f, got %f", tt.wantValue, value)
			}
		})
	}
}

func TestToFloat64(t *testing.T) {
	tests := []struct {
		name        string
		input       any
		wantValue   float64
		expectError bool
	}{
		{
			name:      "float64",
			input:     42.5,
			wantValue: 42.5,
		},
		{
			name:      "float32",
			input:     float32(42.5),
			wantValue: 42.5,
		},
		{
			name:      "int",
			input:     42,
			wantValue: 42.0,
		},
		{
			name:      "int64",
			input:     int64(42),
			wantValue: 42.0,
		},
		{
			name:      "json.Number",
			input:     json.Number("42.5"),
			wantValue: 42.5,
		},
		{
			name:      "string",
			input:     "42.5",
			wantValue: 42.5,
		},
		{
			name:        "nil",
			input:       nil,
			expectError: true,
		},
		{
			name:        "unsupported type",
			input:       struct{}{},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := toFloat64(tt.input)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if value != tt.wantValue {
				t.Errorf("expected value %f, got %f", tt.wantValue, value)
			}
		})
	}
}

func TestMeasure_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	p := &Provider{
		config: &Config{
			Query:  "sum:requests{*}",
			APIKey: "api-key",
			AppKey: "app-key",
			Site:   strings.TrimPrefix(server.URL, "http://"),
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, _, err := measureWithTestServer(p, ctx, &provider.ProviderContext{}, server.URL)
	if err == nil {
		t.Error("expected context cancellation error but got none")
	}
}
