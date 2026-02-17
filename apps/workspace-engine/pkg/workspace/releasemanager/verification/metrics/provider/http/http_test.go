package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

func TestNew(t *testing.T) {
	tests := []struct {
		name        string
		config      *Config
		wantMethod  string
		wantTimeout time.Duration
		expectError bool
	}{
		{
			name: "basic config with defaults",
			config: &Config{
				URL: "http://example.com",
			},
			wantMethod:  "GET",
			wantTimeout: 30 * time.Second,
			expectError: false,
		},
		{
			name: "config with custom method",
			config: &Config{
				URL:    "http://example.com",
				Method: "POST",
			},
			wantMethod:  "POST",
			wantTimeout: 30 * time.Second,
			expectError: false,
		},
		{
			name: "config with custom timeout",
			config: &Config{
				URL:     "http://example.com",
				Timeout: 10 * time.Second,
			},
			wantMethod:  "GET",
			wantTimeout: 10 * time.Second,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider, err := New(tt.config)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if provider.config.Method != tt.wantMethod {
				t.Errorf("expected method %s, got %s", tt.wantMethod, provider.config.Method)
			}

			if provider.config.Timeout != tt.wantTimeout {
				t.Errorf("expected timeout %v, got %v", tt.wantTimeout, provider.config.Timeout)
			}
		})
	}
}

func TestType(t *testing.T) {
	provider := &Provider{}
	if got := provider.Type(); got != "http" {
		t.Errorf("Type() = %v, want %v", got, "http")
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
		checkResult    func(t *testing.T, measuredAt time.Time, data map[string]any)
	}{
		{
			name: "successful GET request",
			config: &Config{
				Method:  "GET",
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Method != "GET" {
						t.Errorf("expected GET method, got %s", r.Method)
					}
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("test response"))
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 200,
			wantError:      false,
			checkResult: func(t *testing.T, measuredAt time.Time, data map[string]any) {
				if body, ok := data["body"].(string); !ok || body != "test response" {
					t.Errorf("expected body 'test response', got %v", data["body"])
				}
			},
		},
		{
			name: "POST request with body",
			config: &Config{
				Method:  "POST",
				Body:    `{"key":"value"}`,
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Method != "POST" {
						t.Errorf("expected POST method, got %s", r.Method)
					}
					w.WriteHeader(http.StatusCreated)
					_, _ = w.Write([]byte(`{"success":true}`))
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 201,
			wantError:      false,
			checkResult: func(t *testing.T, measuredAt time.Time, data map[string]any) {
				if statusCode, ok := data["statusCode"].(int); !ok || statusCode != 201 {
					t.Errorf("expected status code 201, got %v", data["statusCode"])
				}
			},
		},
		{
			name: "request with custom headers",
			config: &Config{
				Method: "GET",
				Headers: map[string]string{
					"Authorization": "Bearer token123",
					"Content-Type":  "application/json",
				},
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if auth := r.Header.Get("Authorization"); auth != "Bearer token123" {
						t.Errorf("expected Authorization header 'Bearer token123', got %s", auth)
					}
					if ct := r.Header.Get("Content-Type"); ct != "application/json" {
						t.Errorf("expected Content-Type header 'application/json', got %s", ct)
					}
					w.WriteHeader(http.StatusOK)
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 200,
			wantError:      false,
		},
		{
			name: "JSON response parsing",
			config: &Config{
				Method:  "GET",
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_ = json.NewEncoder(w).Encode(map[string]any{
						"metric": "value",
						"count":  42,
					})
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 200,
			wantError:      false,
			checkResult: func(t *testing.T, measuredAt time.Time, data map[string]any) {
				jsonData, ok := data["json"].(map[string]any)
				if !ok {
					t.Fatalf("expected json field to be map[string]any, got %T", data["json"])
				}
				if metric, ok := jsonData["metric"].(string); !ok || metric != "value" {
					t.Errorf("expected metric 'value', got %v", jsonData["metric"])
				}
				if count, ok := jsonData["count"].(float64); !ok || count != 42 {
					t.Errorf("expected count 42, got %v", jsonData["count"])
				}
			},
		},
		{
			name: "4xx status code",
			config: &Config{
				Method:  "GET",
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write([]byte("not found"))
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 404,
			wantError:      false,
		},
		{
			name: "5xx status code",
			config: &Config{
				Method:  "GET",
				Timeout: 5 * time.Second,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte("internal error"))
				}))
			},
			providerCtx:    &provider.ProviderContext{},
			wantStatusCode: 500,
			wantError:      false,
		},
		{
			name: "timeout",
			config: &Config{
				Method:  "GET",
				Timeout: 100 * time.Millisecond,
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					time.Sleep(200 * time.Millisecond)
					w.WriteHeader(http.StatusOK)
				}))
			},
			providerCtx: &provider.ProviderContext{},
			wantError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := tt.setupServer()
			defer server.Close()

			// Set URL to test server
			tt.config.URL = server.URL

			provider := &Provider{
				config: tt.config,
			}

			measuredAt, data, err := provider.Measure(context.Background(), tt.providerCtx)

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

			// Check ok field
			expectedOk := tt.wantStatusCode >= 200 && tt.wantStatusCode < 300
			if ok, found := data["ok"].(bool); !found || ok != expectedOk {
				t.Errorf("expected ok %v, got %v", expectedOk, data["ok"])
			}

			// Check that duration exists and is reasonable
			if duration, ok := data["duration"].(int64); !ok || duration < 0 {
				t.Errorf("expected valid duration, got %v", data["duration"])
			}

			// Check that headers exist
			if _, ok := data["headers"].(http.Header); !ok {
				t.Errorf("expected headers to be http.Header, got %T", data["headers"])
			}

			// Check that body exists
			if _, ok := data["body"].(string); !ok {
				t.Errorf("expected body to be string, got %T", data["body"])
			}

			// Check that MeasuredAt is set
			if measuredAt.IsZero() {
				t.Error("expected MeasuredAt to be set")
			}

			// Run custom checks if provided
			if tt.checkResult != nil {
				tt.checkResult(t, measuredAt, data)
			}
		})
	}
}

func TestMeasure_InvalidURL(t *testing.T) {
	p := &Provider{
		config: &Config{
			URL:     "://invalid-url",
			Method:  "GET",
			Timeout: 5 * time.Second,
		},
	}

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err == nil {
		t.Error("expected error for invalid URL but got none")
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
			URL:     server.URL,
			Method:  "GET",
			Timeout: 5 * time.Second,
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, _, err := p.Measure(ctx, &provider.ProviderContext{})
	if err == nil {
		t.Error("expected context cancellation error but got none")
	}
}

func TestResolve(t *testing.T) {
	tests := []struct {
		name        string
		config      *Config
		providerCtx *provider.ProviderContext
		wantURL     string
		wantBody    string
		wantHeaders map[string]string
	}{
		{
			name: "resolve URL template",
			config: &Config{
				URL:    "http://example.com/api/{{ .deployment.id }}",
				Method: "GET",
			},
			providerCtx: &provider.ProviderContext{
				Deployment: &oapi.Deployment{
					Id:   "prod-deploy-123",
					Name: "prod-deployment",
					Slug: "prod-deployment",
				},
			},
			wantURL: "http://example.com/api/prod-deploy-123",
		},
		{
			name: "resolve body template",
			config: &Config{
				URL:    "http://example.com",
				Method: "POST",
				Body:   `{"env":"{{ .environment.name }}"}`,
			},
			providerCtx: &provider.ProviderContext{
				Environment: &oapi.Environment{
					Id:        "env-456",
					Name:      "staging",
					CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				},
			},
			wantURL:  "http://example.com",
			wantBody: `{"env":"staging"}`,
		},
		{
			name: "resolve header templates",
			config: &Config{
				URL:    "http://example.com",
				Method: "GET",
				Headers: map[string]string{
					"X-Environment": "{{ .environment.name }}",
					"X-Deployment":  "{{ .deployment.name }}",
				},
			},
			providerCtx: &provider.ProviderContext{
				Environment: &oapi.Environment{
					Id:        "env-456",
					Name:      "prod",
					CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				Deployment: &oapi.Deployment{
					Id:   "deploy-789",
					Name: "api-deployment",
					Slug: "api-deployment",
				},
			},
			wantURL: "http://example.com",
			wantHeaders: map[string]string{
				"X-Environment": "prod",
				"X-Deployment":  "api-deployment",
			},
		},
		{
			name: "no templates",
			config: &Config{
				URL:    "http://example.com",
				Method: "GET",
				Body:   "plain body",
			},
			providerCtx: &provider.ProviderContext{},
			wantURL:     "http://example.com",
			wantBody:    "plain body",
		},
		{
			name: "resolve with variables",
			config: &Config{
				URL:    "http://example.com/{{ .variables.service }}",
				Method: "GET",
			},
			providerCtx: &provider.ProviderContext{
				Variables: map[string]any{
					"service": "api",
				},
			},
			wantURL: "http://example.com/api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved := Resolve(tt.config, tt.providerCtx)

			if resolved.URL != tt.wantURL {
				t.Errorf("expected URL %s, got %s", tt.wantURL, resolved.URL)
			}

			if tt.wantBody != "" && resolved.Body != tt.wantBody {
				t.Errorf("expected body %s, got %s", tt.wantBody, resolved.Body)
			}

			if tt.wantHeaders != nil {
				for key, want := range tt.wantHeaders {
					if got := resolved.Headers[key]; got != want {
						t.Errorf("expected header %s=%s, got %s", key, want, got)
					}
				}
			}

			// Verify method and timeout are preserved
			if resolved.Method != tt.config.Method {
				t.Errorf("expected method %s, got %s", tt.config.Method, resolved.Method)
			}

			if resolved.Timeout != tt.config.Timeout {
				t.Errorf("expected timeout %v, got %v", tt.config.Timeout, resolved.Timeout)
			}
		})
	}
}

func TestResolve_EmptyHeaders(t *testing.T) {
	config := &Config{
		URL:     "http://example.com",
		Method:  "GET",
		Headers: nil,
	}

	providerCtx := &provider.ProviderContext{}

	resolved := Resolve(config, providerCtx)

	if resolved.Headers == nil {
		t.Error("expected headers to be initialized, got nil")
	}

	if len(resolved.Headers) != 0 {
		t.Errorf("expected empty headers map, got %d items", len(resolved.Headers))
	}
}
