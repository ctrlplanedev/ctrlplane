package trace

import (
	"testing"
	"time"

	"go.opentelemetry.io/otel/attribute"
)

func TestBuildAttributes(t *testing.T) {
	workspaceID := "workspace-1"
	releaseTargetKey := "api-service-production"
	releaseID := "release-123"
	jobID := "job-456"
	parentTraceID := "parent-789"

	tests := []struct {
		name              string
		phase             Phase
		nodeType          NodeType
		status            Status
		depth             int
		sequence          int
		workspaceID       string
		releaseTargetKey  *string
		releaseID         *string
		jobID             *string
		parentTraceID     *string
		expectedAttrCount int
	}{
		{
			name:              "minimal attributes",
			phase:             PhasePlanning,
			nodeType:          NodeTypePhase,
			status:            StatusRunning,
			depth:             1,
			sequence:          1,
			workspaceID:       workspaceID,
			releaseTargetKey:  nil,
			releaseID:         nil,
			jobID:             nil,
			parentTraceID:     nil,
			expectedAttrCount: 6, // phase, nodeType, status, depth, sequence, workspaceID
		},
		{
			name:              "all attributes",
			phase:             PhaseExecution,
			nodeType:          NodeTypeAction,
			status:            StatusCompleted,
			depth:             2,
			sequence:          5,
			workspaceID:       workspaceID,
			releaseTargetKey:  &releaseTargetKey,
			releaseID:         &releaseID,
			jobID:             &jobID,
			parentTraceID:     &parentTraceID,
			expectedAttrCount: 10, // all fields populated
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var opts []AttributeOption
			if tt.releaseID != nil {
				opts = append(opts, WithReleaseID(*tt.releaseID))
			}
			if tt.jobID != nil {
				opts = append(opts, WithJobID(*tt.jobID))
			}
			if tt.parentTraceID != nil {
				opts = append(opts, WithParentTraceID(*tt.parentTraceID))
			}

			attrs := buildAttributes(
				tt.phase,
				tt.nodeType,
				tt.status,
				tt.depth,
				tt.sequence,
				tt.workspaceID,
				tt.releaseTargetKey,
				opts...,
			)

			if len(attrs) != tt.expectedAttrCount {
				t.Errorf("expected %d attributes, got %d", tt.expectedAttrCount, len(attrs))
			}

			// Verify required attributes are present
			hasPhase := false
			hasNodeType := false
			hasStatus := false

			for _, attr := range attrs {
				switch attr.Key {
				case attrPhase:
					hasPhase = true
					if attr.Value.AsString() != string(tt.phase) {
						t.Errorf("expected phase %s, got %s", tt.phase, attr.Value.AsString())
					}
				case attrNodeType:
					hasNodeType = true
					if attr.Value.AsString() != string(tt.nodeType) {
						t.Errorf("expected nodeType %s, got %s", tt.nodeType, attr.Value.AsString())
					}
				case attrStatus:
					hasStatus = true
					if attr.Value.AsString() != string(tt.status) {
						t.Errorf("expected status %s, got %s", tt.status, attr.Value.AsString())
					}
				}
			}

			if !hasPhase {
				t.Error("missing phase attribute")
			}
			if !hasNodeType {
				t.Error("missing nodeType attribute")
			}
			if !hasStatus {
				t.Error("missing status attribute")
			}
		})
	}
}

func TestMetadataToAttributes(t *testing.T) {
	tests := []struct {
		name          string
		key           string
		value         interface{}
		expectedType  attribute.Type
		expectedValue interface{}
	}{
		{
			name:          "string value",
			key:           "test_key",
			value:         "test_value",
			expectedType:  attribute.STRING,
			expectedValue: "test_value",
		},
		{
			name:          "int value",
			key:           "test_int",
			value:         42,
			expectedType:  attribute.INT64,
			expectedValue: int64(42),
		},
		{
			name:          "int64 value",
			key:           "test_int64",
			value:         int64(123),
			expectedType:  attribute.INT64,
			expectedValue: int64(123),
		},
		{
			name:          "float64 value",
			key:           "test_float",
			value:         3.14,
			expectedType:  attribute.FLOAT64,
			expectedValue: 3.14,
		},
		{
			name:          "bool value",
			key:           "test_bool",
			value:         true,
			expectedType:  attribute.BOOL,
			expectedValue: true,
		},
		{
			name:          "string slice value",
			key:           "test_slice",
			value:         []string{"a", "b", "c"},
			expectedType:  attribute.STRINGSLICE,
			expectedValue: []string{"a", "b", "c"},
		},
		{
			name:          "time value",
			key:           "test_time",
			value:         time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
			expectedType:  attribute.STRING,
			expectedValue: "2024-01-01T12:00:00Z",
		},
		{
			name:          "unknown type",
			key:           "test_unknown",
			value:         struct{ Name string }{"test"},
			expectedType:  attribute.STRING,
			expectedValue: "{test}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := metadataToAttributes(tt.key, tt.value)

			if len(attrs) != 1 {
				t.Fatalf("expected 1 attribute, got %d", len(attrs))
			}

			attr := attrs[0]

			if attr.Key != attribute.Key(tt.key) {
				t.Errorf("expected key %s, got %s", tt.key, attr.Key)
			}

			if attr.Value.Type() != tt.expectedType {
				t.Errorf("expected type %v, got %v", tt.expectedType, attr.Value.Type())
			}

			// Verify value based on type
			switch tt.expectedType {
			case attribute.STRING:
				if attr.Value.AsString() != tt.expectedValue.(string) {
					t.Errorf("expected value %v, got %v", tt.expectedValue, attr.Value.AsString())
				}
			case attribute.INT64:
				if attr.Value.AsInt64() != tt.expectedValue.(int64) {
					t.Errorf("expected value %v, got %v", tt.expectedValue, attr.Value.AsInt64())
				}
			case attribute.FLOAT64:
				if attr.Value.AsFloat64() != tt.expectedValue.(float64) {
					t.Errorf("expected value %v, got %v", tt.expectedValue, attr.Value.AsFloat64())
				}
			case attribute.BOOL:
				if attr.Value.AsBool() != tt.expectedValue.(bool) {
					t.Errorf("expected value %v, got %v", tt.expectedValue, attr.Value.AsBool())
				}
			case attribute.STRINGSLICE:
				expected := tt.expectedValue.([]string)
				actual := attr.Value.AsStringSlice()
				if len(actual) != len(expected) {
					t.Errorf("expected slice length %d, got %d", len(expected), len(actual))
				}
				for i, v := range expected {
					if actual[i] != v {
						t.Errorf("expected value[%d] %s, got %s", i, v, actual[i])
					}
				}
			}
		})
	}
}

func TestPhaseConstants(t *testing.T) {
	phases := []Phase{
		PhaseReconciliation,
		PhasePlanning,
		PhaseEligibility,
		PhaseExecution,
		PhaseAction,
		PhaseExternal,
	}

	for _, phase := range phases {
		if string(phase) == "" {
			t.Errorf("phase constant is empty: %v", phase)
		}
	}
}

func TestNodeTypeConstants(t *testing.T) {
	nodeTypes := []NodeType{
		NodeTypePhase,
		NodeTypeEvaluation,
		NodeTypeCheck,
		NodeTypeDecision,
		NodeTypeAction,
	}

	for _, nodeType := range nodeTypes {
		if string(nodeType) == "" {
			t.Errorf("nodeType constant is empty: %v", nodeType)
		}
	}
}

func TestStatusConstants(t *testing.T) {
	statuses := []Status{
		StatusRunning,
		StatusCompleted,
		StatusFailed,
		StatusSkipped,
	}

	for _, status := range statuses {
		if string(status) == "" {
			t.Errorf("status constant is empty: %v", status)
		}
	}
}

func TestResultConstants(t *testing.T) {
	evalResults := []EvaluationResult{ResultAllowed, ResultBlocked}
	for _, result := range evalResults {
		if string(result) == "" {
			t.Errorf("evaluation result constant is empty: %v", result)
		}
	}

	checkResults := []CheckResult{CheckResultPass, CheckResultFail}
	for _, result := range checkResults {
		if string(result) == "" {
			t.Errorf("check result constant is empty: %v", result)
		}
	}

	stepResults := []StepResult{StepResultPass, StepResultFail}
	for _, result := range stepResults {
		if string(result) == "" {
			t.Errorf("step result constant is empty: %v", result)
		}
	}
}

func TestDecisionConstants(t *testing.T) {
	decisions := []Decision{DecisionApproved, DecisionRejected}

	for _, decision := range decisions {
		if string(decision) == "" {
			t.Errorf("decision constant is empty: %v", decision)
		}
	}
}
