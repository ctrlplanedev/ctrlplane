package terraformcloud

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

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

func TestNewFromJSON(t *testing.T) {
	tests := []struct {
		name        string
		input       json.RawMessage
		wantAddress string
		wantToken   string
		wantRunId   string
		expectError bool
	}{
		{
			name:        "valid config with all fields",
			input:       json.RawMessage(`{"type":"terraformCloudRun","address":"https://app.terraform.io","token":"tfe-token-123","runId":"run-xyz789"}`),
			wantAddress: "https://app.terraform.io",
			wantToken:   "tfe-token-123",
			wantRunId:   "run-xyz789",
		},
		{
			name:        "missing fields use defaults",
			input:       json.RawMessage(`{}`),
			wantAddress: "",
			wantToken:   "",
			wantRunId:   "",
		},
		{
			name:        "invalid JSON",
			input:       json.RawMessage(`{invalid}`),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewFromJSON(tt.input)
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

func TestType(t *testing.T) {
	p := &Provider{}
	if got := p.Type(); got != "terraformcloud" {
		t.Errorf("Type() = %q, want %q", got, "terraformcloud")
	}
}

func TestConfig(t *testing.T) {
	config := &Config{Address: "https://app.terraform.io", Token: "test-token", RunId: "run-123"}
	p := New(config)
	if p.Config() != config {
		t.Error("Config() should return the same config instance")
	}
}

func TestConvertRunToData(t *testing.T) {
	p := &Provider{}
	run := &tfe.Run{
		ID:         "run-abc123",
		Status:     tfe.RunApplied,
		HasChanges: true,
		IsDestroy:  false,
	}
	data := p.convertRunToData(run)
	if data["runId"] != "run-abc123" {
		t.Errorf("expected runId 'run-abc123', got %v", data["runId"])
	}
	if data["status"] != tfe.RunApplied {
		t.Errorf("expected status RunApplied, got %v", data["status"])
	}
	if data["hasChanges"] != true {
		t.Errorf("expected hasChanges true, got %v", data["hasChanges"])
	}
}

func TestConvertRunToData_AllFieldsPresent(t *testing.T) {
	p := &Provider{}
	data := p.convertRunToData(&tfe.Run{ID: "run-test"})

	expectedFields := []string{
		"runId", "status", "hasChanges", "isDestroy", "refresh",
		"refreshOnly", "replaceAddrs", "savePlan", "source",
		"statusTimestamps", "targetAddrs", "terraformVersion",
		"triggerReason", "variables", "apply", "configurationVersion",
		"costEstimate", "createdBy", "confirmedBy", "plan",
		"policyChecks", "runEvents", "taskStages", "workspace",
		"comments", "actions", "policyPaths", "positionInQueue", "planOnly",
	}
	for _, key := range expectedFields {
		if _, exists := data[key]; !exists {
			t.Errorf("expected key %q to exist in data", key)
		}
	}
}

func TestMeasure_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path == "/api/v2/runs/run-test123" {
			w.Header().Set("Content-Type", "application/vnd.api+json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"id": "run-test123", "type": "runs",
					"attributes": map[string]any{"status": "applied", "has-changes": true},
					"relationships": map[string]any{
						"workspace": map[string]any{"data": map[string]any{"id": "ws-abc", "type": "workspaces"}},
					},
				},
				"included": []map[string]any{
					{"id": "ws-abc", "type": "workspaces", "attributes": map[string]any{"name": "my-workspace"}},
				},
			})
			return
		}
		t.Errorf("unexpected path: %s", r.URL.Path)
	}))
	defer server.Close()

	p := New(&Config{Address: server.URL, Token: "test-token", RunId: "run-test123"})
	measuredAt, data, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if time.Since(measuredAt) > 5*time.Second {
		t.Error("measuredAt should be recent")
	}
	if _, ok := data["duration"]; !ok {
		t.Error("expected duration field in result")
	}
}

func TestMeasure_RunNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v2/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{{"status": "404", "title": "not found"}},
		})
	}))
	defer server.Close()

	p := New(&Config{Address: server.URL, Token: "valid-token", RunId: "run-nonexistent"})
	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err == nil {
		t.Error("expected error for non-existent run")
	}
}

func TestMeasure_InvalidAddress(t *testing.T) {
	p := New(&Config{Address: "http://invalid-address-that-does-not-exist.local:99999", Token: "test-token", RunId: "run-123"})
	_, _, err := p.Measure(context.Background(), &provider.ProviderContext{})
	if err == nil {
		t.Error("expected error for invalid address")
	}
}
