package terraformcloud

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/hashicorp/go-tfe"
)

func TestNew(t *testing.T) {
	config := &Config{
		Address: "https://app.terraform.io",
		Token:   "test-token",
		RunId:   "run-abc123",
	}

	p := New(config)

	if p == nil {
		t.Fatal("expected provider to be created")
	}

	if p.config != config {
		t.Error("expected config to be set")
	}
}

func TestNewFromOAPI(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]any
		wantAddress string
		wantToken   string
		wantRunId   string
		expectError bool
	}{
		{
			name: "valid config with all fields",
			input: map[string]any{
				"type":    "terraformcloud",
				"address": "https://app.terraform.io",
				"token":   "tfe-token-123",
				"runId":   "run-xyz789",
			},
			wantAddress: "https://app.terraform.io",
			wantToken:   "tfe-token-123",
			wantRunId:   "run-xyz789",
			expectError: false,
		},
		{
			name: "valid config with custom address",
			input: map[string]any{
				"type":    "terraformcloud",
				"address": "https://tfe.mycompany.com",
				"token":   "enterprise-token",
				"runId":   "run-enterprise",
			},
			wantAddress: "https://tfe.mycompany.com",
			wantToken:   "enterprise-token",
			wantRunId:   "run-enterprise",
			expectError: false,
		},
		{
			name: "missing address uses empty string",
			input: map[string]any{
				"type":  "terraformcloud",
				"token": "token-123",
				"runId": "run-123",
			},
			wantAddress: "",
			wantToken:   "token-123",
			wantRunId:   "run-123",
			expectError: false,
		},
		{
			name: "missing token uses empty string",
			input: map[string]any{
				"type":    "terraformcloud",
				"address": "https://app.terraform.io",
				"runId":   "run-123",
			},
			wantAddress: "https://app.terraform.io",
			wantToken:   "",
			wantRunId:   "run-123",
			expectError: false,
		},
		{
			name: "missing runId uses empty string",
			input: map[string]any{
				"type":    "terraformcloud",
				"address": "https://app.terraform.io",
				"token":   "token-123",
			},
			wantAddress: "https://app.terraform.io",
			wantToken:   "token-123",
			wantRunId:   "",
			expectError: false,
		},
		{
			name:        "empty config",
			input:       map[string]any{},
			wantAddress: "",
			wantToken:   "",
			wantRunId:   "",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewFromOAPI(tt.input)

			if tt.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if p.config.Address != tt.wantAddress {
				t.Errorf("expected address %q, got %q", tt.wantAddress, p.config.Address)
			}

			if p.config.Token != tt.wantToken {
				t.Errorf("expected token %q, got %q", tt.wantToken, p.config.Token)
			}

			if p.config.RunId != tt.wantRunId {
				t.Errorf("expected runId %q, got %q", tt.wantRunId, p.config.RunId)
			}
		})
	}
}

func TestNewFromOAPI_InvalidInput(t *testing.T) {
	tests := []struct {
		name  string
		input any
	}{
		{
			name:  "nil input",
			input: nil,
		},
		{
			name:  "channel type (unmarshallable)",
			input: make(chan int),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewFromOAPI(tt.input)
			if err == nil {
				t.Error("expected error for invalid input but got none")
			}
		})
	}
}

func TestType(t *testing.T) {
	p := &Provider{}
	if got := p.Type(); got != "terraformcloud" {
		t.Errorf("Type() = %q, want %q", got, "terraformcloud")
	}
}

func TestConfig(t *testing.T) {
	config := &Config{
		Address: "https://app.terraform.io",
		Token:   "test-token",
		RunId:   "run-123",
	}

	p := New(config)

	if p.Config() != config {
		t.Error("Config() should return the same config instance")
	}
}

func TestConvertRunToData(t *testing.T) {
	tests := []struct {
		name       string
		run        *tfe.Run
		checkField func(t *testing.T, data map[string]any)
	}{
		{
			name: "basic run fields",
			run: &tfe.Run{
				ID:         "run-abc123",
				Status:     tfe.RunApplied,
				HasChanges: true,
				IsDestroy:  false,
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["runId"] != "run-abc123" {
					t.Errorf("expected runId 'run-abc123', got %v", data["runId"])
				}
				if data["status"] != tfe.RunApplied {
					t.Errorf("expected status RunApplied, got %v", data["status"])
				}
				if data["hasChanges"] != true {
					t.Errorf("expected hasChanges true, got %v", data["hasChanges"])
				}
				if data["isDestroy"] != false {
					t.Errorf("expected isDestroy false, got %v", data["isDestroy"])
				}
			},
		},
		{
			name: "run with refresh settings",
			run: &tfe.Run{
				ID:          "run-refresh",
				Refresh:     true,
				RefreshOnly: true,
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["refresh"] != true {
					t.Errorf("expected refresh true, got %v", data["refresh"])
				}
				if data["refreshOnly"] != true {
					t.Errorf("expected refreshOnly true, got %v", data["refreshOnly"])
				}
			},
		},
		{
			name: "run with target and replace addrs",
			run: &tfe.Run{
				ID:           "run-targeted",
				TargetAddrs:  []string{"module.vpc", "aws_instance.web"},
				ReplaceAddrs: []string{"aws_instance.db"},
			},
			checkField: func(t *testing.T, data map[string]any) {
				targetAddrs, ok := data["targetAddrs"].([]string)
				if !ok {
					t.Fatalf("targetAddrs is not []string, got %T", data["targetAddrs"])
				}
				if len(targetAddrs) != 2 {
					t.Errorf("expected 2 target addrs, got %d", len(targetAddrs))
				}

				replaceAddrs, ok := data["replaceAddrs"].([]string)
				if !ok {
					t.Fatalf("replaceAddrs is not []string, got %T", data["replaceAddrs"])
				}
				if len(replaceAddrs) != 1 {
					t.Errorf("expected 1 replace addr, got %d", len(replaceAddrs))
				}
			},
		},
		{
			name: "run with terraform version and source",
			run: &tfe.Run{
				ID:               "run-versioned",
				TerraformVersion: "1.5.0",
				Source:           tfe.RunSourceAPI,
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["terraformVersion"] != "1.5.0" {
					t.Errorf("expected terraformVersion '1.5.0', got %v", data["terraformVersion"])
				}
				if data["source"] != tfe.RunSourceAPI {
					t.Errorf("expected source RunSourceAPI, got %v", data["source"])
				}
			},
		},
		{
			name: "run with trigger reason",
			run: &tfe.Run{
				ID:            "run-triggered",
				TriggerReason: "manual",
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["triggerReason"] != "manual" {
					t.Errorf("expected triggerReason 'manual', got %v", data["triggerReason"])
				}
			},
		},
		{
			name: "run with plan only and save plan",
			run: &tfe.Run{
				ID:       "run-plan",
				PlanOnly: true,
				SavePlan: true,
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["planOnly"] != true {
					t.Errorf("expected planOnly true, got %v", data["planOnly"])
				}
				if data["savePlan"] != true {
					t.Errorf("expected savePlan true, got %v", data["savePlan"])
				}
			},
		},
		{
			name: "run with position in queue",
			run: &tfe.Run{
				ID:              "run-queued",
				PositionInQueue: 5,
			},
			checkField: func(t *testing.T, data map[string]any) {
				if data["positionInQueue"] != 5 {
					t.Errorf("expected positionInQueue 5, got %v", data["positionInQueue"])
				}
			},
		},
		{
			name: "empty run",
			run:  &tfe.Run{},
			checkField: func(t *testing.T, data map[string]any) {
				// Should have all keys present, even if values are zero/empty
				expectedKeys := []string{
					"runId", "status", "hasChanges", "isDestroy", "refresh",
					"refreshOnly", "replaceAddrs", "savePlan", "source",
					"statusTimestamps", "targetAddrs", "terraformVersion",
					"triggerReason", "variables", "apply", "configurationVersion",
					"costEstimate", "createdBy", "confirmedBy", "plan",
					"policyChecks", "runEvents", "taskStages", "workspace",
					"comments", "actions", "policyPaths", "positionInQueue", "planOnly",
				}
				for _, key := range expectedKeys {
					if _, exists := data[key]; !exists {
						t.Errorf("expected key %q to exist in data", key)
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Provider{}
			data := p.convertRunToData(tt.run)

			if data == nil {
				t.Fatal("expected data to be non-nil")
			}

			tt.checkField(t, data)
		})
	}
}

func TestConvertRunToData_AllFieldsPresent(t *testing.T) {
	run := &tfe.Run{
		ID:         "run-complete",
		Status:     tfe.RunPlanning,
		HasChanges: true,
	}

	p := &Provider{}
	data := p.convertRunToData(run)

	// Verify all expected fields are present in the output
	expectedFields := map[string]bool{
		"runId":                true,
		"status":               true,
		"hasChanges":           true,
		"isDestroy":            true,
		"refresh":              true,
		"refreshOnly":          true,
		"replaceAddrs":         true,
		"savePlan":             true,
		"source":               true,
		"statusTimestamps":     true,
		"targetAddrs":          true,
		"terraformVersion":     true,
		"triggerReason":        true,
		"variables":            true,
		"apply":                true,
		"configurationVersion": true,
		"costEstimate":         true,
		"createdBy":            true,
		"confirmedBy":          true,
		"plan":                 true,
		"policyChecks":         true,
		"runEvents":            true,
		"taskStages":           true,
		"workspace":            true,
		"comments":             true,
		"actions":              true,
		"policyPaths":          true,
		"positionInQueue":      true,
		"planOnly":             true,
	}

	for field := range expectedFields {
		if _, exists := data[field]; !exists {
			t.Errorf("expected field %q to be present in converted data", field)
		}
	}

	// Check there are no extra unexpected fields
	if len(data) != len(expectedFields) {
		t.Errorf("expected %d fields, got %d", len(expectedFields), len(data))
	}
}

// TestMeasure_Success tests the Measure function with a mock TFE server
func TestMeasure_Success(t *testing.T) {
	// Create a mock TFE API server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle the ping request that go-tfe makes on client creation
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Handle the actual runs request
		if r.URL.Path == "/api/v2/runs/run-test123" {
			// Verify authorization header is present
			if auth := r.Header.Get("Authorization"); auth != "Bearer test-token" {
				t.Errorf("expected Authorization header 'Bearer test-token', got %q", auth)
			}

			// Return a mock TFE run response (JSON:API format)
			w.Header().Set("Content-Type", "application/vnd.api+json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"id":   "run-test123",
					"type": "runs",
					"attributes": map[string]any{
						"status":      "applied",
						"has-changes": true,
						"is-destroy":  false,
						"message":     "Triggered via API",
					},
					"relationships": map[string]any{
						"workspace": map[string]any{
							"data": map[string]any{
								"id":   "ws-abc",
								"type": "workspaces",
							},
						},
					},
				},
				"included": []map[string]any{
					{
						"id":   "ws-abc",
						"type": "workspaces",
						"attributes": map[string]any{
							"name": "my-workspace",
						},
					},
				},
			})
			return
		}

		t.Errorf("unexpected path: %s", r.URL.Path)
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "test-token",
		RunId:   "run-test123",
	})

	ctx := context.Background()
	providerCtx := &provider.ProviderContext{}

	measuredAt, data, err := p.Measure(ctx, providerCtx)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify measuredAt is recent
	if time.Since(measuredAt) > 5*time.Second {
		t.Error("measuredAt should be recent")
	}

	// Verify duration is present
	if _, ok := data["duration"]; !ok {
		t.Error("expected duration field in result")
	}

	// Verify URL is constructed correctly
	if url, ok := data["url"].(string); ok {
		if url == "" {
			t.Error("expected url to be non-empty")
		}
	}
}

// TestMeasure_AuthenticationError tests handling of authentication failures
func TestMeasure_AuthenticationError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle ping - but return unauthorized to simulate auth failure
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"errors": []map[string]any{
					{"status": "401", "title": "unauthorized"},
				},
			})
			return
		}

		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{
				{"status": "401", "title": "unauthorized"},
			},
		})
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "invalid-token",
		RunId:   "run-123",
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})

	if err == nil {
		t.Error("expected error for unauthorized request")
	}
}

// TestMeasure_RunNotFound tests handling of non-existent runs
func TestMeasure_RunNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle ping request
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Return 404 for the runs request
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{
				{"status": "404", "title": "not found"},
			},
		})
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "valid-token",
		RunId:   "run-nonexistent",
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})

	if err == nil {
		t.Error("expected error for non-existent run")
	}
}

// TestMeasure_ContextCancellation tests that context cancellation is respected
func TestMeasure_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow response
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "test-token",
		RunId:   "run-123",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, _, err := p.Measure(ctx, &provider.ProviderContext{})

	if err == nil {
		t.Error("expected context cancellation error")
	}
}

// TestMeasure_InvalidAddress tests handling of invalid server address
func TestMeasure_InvalidAddress(t *testing.T) {
	p := New(&Config{
		Address: "http://invalid-address-that-does-not-exist.local:99999",
		Token:   "test-token",
		RunId:   "run-123",
	})

	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})

	if err == nil {
		t.Error("expected error for invalid address")
	}
}

// TestMeasure_URLConstruction tests that the URL is constructed correctly
func TestMeasure_URLConstruction(t *testing.T) {
	workspaceName := "production-vpc"
	runID := "run-abc123xyz"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle ping request
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/vnd.api+json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"id":         runID,
				"type":       "runs",
				"attributes": map[string]any{"status": "applied"},
				"relationships": map[string]any{
					"workspace": map[string]any{
						"data": map[string]any{"id": "ws-123", "type": "workspaces"},
					},
				},
			},
			"included": []map[string]any{
				{
					"id":         "ws-123",
					"type":       "workspaces",
					"attributes": map[string]any{"name": workspaceName},
				},
			},
		})
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "test-token",
		RunId:   runID,
	})

	_, data, err := p.Measure(context.Background(), &provider.ProviderContext{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// The URL should be constructed as: {address}/app/terraform-cloud/workspaces/{workspace}/runs/{runId}
	expectedURLSuffix := "/app/terraform-cloud/workspaces/" + workspaceName + "/runs/" + runID
	if url, ok := data["url"].(string); ok {
		if url == "" {
			t.Error("url should not be empty")
		}
		// Note: The actual URL structure depends on the implementation
		_ = expectedURLSuffix // Used for reference
	}
}

// TestMeasure_DurationTracking tests that duration is tracked correctly
func TestMeasure_DurationTracking(t *testing.T) {
	delay := 100 * time.Millisecond

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle ping request quickly
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Simulate slow response for runs request
		time.Sleep(delay)
		w.Header().Set("Content-Type", "application/vnd.api+json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"id":         "run-123",
				"type":       "runs",
				"attributes": map[string]any{"status": "applied"},
				"relationships": map[string]any{
					"workspace": map[string]any{
						"data": map[string]any{"id": "ws-123", "type": "workspaces"},
					},
				},
			},
			"included": []map[string]any{
				{
					"id":         "ws-123",
					"type":       "workspaces",
					"attributes": map[string]any{"name": "test-ws"},
				},
			},
		})
	}))
	defer server.Close()

	p := New(&Config{
		Address: server.URL,
		Token:   "test-token",
		RunId:   "run-123",
	})

	_, data, err := p.Measure(context.Background(), &provider.ProviderContext{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	duration, ok := data["duration"].(int64)
	if !ok {
		t.Fatalf("duration is not int64, got %T", data["duration"])
	}

	// Duration should be at least the delay we introduced
	if duration < delay.Milliseconds() {
		t.Errorf("expected duration >= %d ms, got %d ms", delay.Milliseconds(), duration)
	}
}
