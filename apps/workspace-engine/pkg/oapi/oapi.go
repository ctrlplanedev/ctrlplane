//go:generate sh -c "jsonnetfmt -i ../../oapi/spec/**/*.jsonnet"
//go:generate sh -c "jsonnet ../../oapi/spec/main.jsonnet > ../../oapi/openapi.json"
//go:generate go tool oapi-codegen -config ../../oapi/cfg.yaml ../../oapi/openapi.json

package oapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (r *Release) ID() string {
	// Collect relevant fields for deterministic ID
	var sb strings.Builder
	sb.WriteString(r.Version.Id)
	sb.WriteString(r.Version.Tag)

	// Sort variable keys for determinism
	keys := make([]string, 0, len(r.Variables))
	for k := range r.Variables {
		keys = append(keys, k)
	}

	sort.Strings(keys)
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(toString(r.Variables[k]))
		sb.WriteString(";")
	}

	sb.WriteString(r.ReleaseTarget.Key())

	// Hash the concatenated string
	hash := sha256.Sum256([]byte(sb.String()))
	return hex.EncodeToString(hash[:])
}

func (r *Release) UUID() uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(r.ID()))
}

func toString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case int:
		return string(rune(t))
	case int64:
		return string(rune(t))
	case float64:
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", t), "0"), ".")
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", t)
	}
}

func (x *ReleaseTarget) Key() string {
	return x.ResourceId + "-" + x.EnvironmentId + "-" + x.DeploymentId
}

func (rv *ResourceVariable) ID() string {
	return rv.ResourceId + "-" + rv.Key
}

func (x *UserApprovalRecord) Key() string {
	return x.VersionId + x.UserId + x.EnvironmentId
}

func (j *Job) IsInProcessingState() bool {
	return j.Status == JobStatusInProgress || j.Status == JobStatusActionRequired || j.Status == JobStatusPending
}

func (j *Job) IsInTerminalState() bool {
	return j.Status == JobStatusCancelled || j.Status == JobStatusSkipped || j.Status == JobStatusSuccessful || j.Status == JobStatusFailure || j.Status == JobStatusInvalidJobAgent || j.Status == JobStatusInvalidIntegration || j.Status == JobStatusExternalRunNotFound
}

func (v *Value) GetType() (string, error) {
	// Try ReferenceValue - check that required fields are present
	if rv, err := v.AsReferenceValue(); err == nil {
		if rv.Reference != "" && rv.Path != nil {
			return "reference", nil
		}
	}

	// Try SensitiveValue - check that required fields are present
	if sv, err := v.AsSensitiveValue(); err == nil {
		if sv.ValueHash != "" {
			return "sensitive", nil
		}
	}

	// Try LiteralValue (fallback - anything else is a literal)
	if _, err := v.AsLiteralValue(); err == nil {
		return "literal", nil
	}

	return "", fmt.Errorf("unable to determine value type")
}

// GetInterval parses and returns the interval duration from the metric spec
func (vms *VerificationMetricSpec) GetInterval() time.Duration {
	return time.Duration(vms.IntervalSeconds) * time.Second

}

// GetFailureLimit returns the failure limit, defaulting to 0 if not set
func (vms *VerificationMetricSpec) GetFailureLimit() int {
	if vms.FailureThreshold == nil {
		return 0
	}
	return *vms.FailureThreshold
}

// GetInterval parses and returns the interval duration from the metric status
func (vms *VerificationMetricStatus) GetInterval() time.Duration {
	return time.Duration(vms.IntervalSeconds) * time.Second
}

// GetFailureLimit returns the failure limit, defaulting to 0 if not set
func (vms *VerificationMetricStatus) GetFailureLimit() int {
	if vms.FailureThreshold == nil {
		return 0
	}
	return *vms.FailureThreshold
}

// Status computes the overall verification status from its metrics
func (jv *JobVerification) Status() JobVerificationStatus {
	if len(jv.Metrics) == 0 {
		return JobVerificationStatusRunning
	}

	for _, metric := range jv.Metrics {
		// Check if this metric has hit its failure limit
		failureLimit := metric.GetFailureLimit()
		successThreshold := metric.SuccessThreshold
		failedCount := 0
		consecutiveSuccessCount := 0
		for _, m := range metric.Measurements {
			switch m.Status {
			case Failed:
				failedCount++
				consecutiveSuccessCount = 0
			case Passed:
				consecutiveSuccessCount++
			case Inconclusive:
				// Inconclusive doesn't count as failure, but breaks consecutive success
				consecutiveSuccessCount = 0
			}
		}

		isFailureLimitZero := failureLimit == 0
		hasAnyFailures := failedCount > 0
		isFailureLimitExceeded := failureLimit > 0 && failedCount > failureLimit
		if (isFailureLimitZero && hasAnyFailures) || isFailureLimitExceeded {
			return JobVerificationStatusFailed
		}

		if successThreshold != nil && consecutiveSuccessCount >= *successThreshold {
			continue
		}

		// Check if metric is complete
		if len(metric.Measurements) < metric.Count {
			return JobVerificationStatusRunning
		}
	}

	return JobVerificationStatusPassed
}

// StartedAt returns the earliest measurement time across all metrics
func (jv *JobVerification) StartedAt() *time.Time {
	var earliest *time.Time

	for _, metric := range jv.Metrics {
		if len(metric.Measurements) > 0 {
			firstMeasurement := metric.Measurements[0].MeasuredAt
			if earliest == nil || firstMeasurement.Before(*earliest) {
				earliest = &firstMeasurement
			}
		}
	}

	return earliest
}

// CompletedAt returns the latest measurement time if all metrics are complete, nil otherwise
func (jv *JobVerification) CompletedAt() *time.Time {
	if jv.Status() == JobVerificationStatusRunning {
		return nil
	}

	var latest *time.Time

	for _, metric := range jv.Metrics {
		if len(metric.Measurements) > 0 {
			lastMeasurement := metric.Measurements[len(metric.Measurements)-1].MeasuredAt
			if latest == nil || lastMeasurement.After(*latest) {
				latest = &lastMeasurement
			}
		}
	}

	return latest
}

// NewLiteralValue creates a new LiteralValue from a Go value
func NewLiteralValue(value any) *LiteralValue {
	literalValue := &LiteralValue{}
	switch v := value.(type) {
	case string:
		_ = literalValue.FromStringValue(v)
	case int:
		_ = literalValue.FromIntegerValue(v)
	case int64:
		_ = literalValue.FromIntegerValue(int(v))
	case float32:
		_ = literalValue.FromNumberValue(v)
	case float64:
		_ = literalValue.FromNumberValue(float32(v))
	case bool:
		_ = literalValue.FromBooleanValue(v)
	case map[string]any:
		_ = literalValue.FromObjectValue(ObjectValue{Object: v})
	case []any:
		b, _ := json.Marshal(v)
		_ = literalValue.UnmarshalJSON(b)
	case nil:
		_ = literalValue.FromNullValue(true)
	}
	return literalValue
}

// NewValueFromLiteral creates a new Value with a literal data type
func NewValueFromLiteral(literalValue *LiteralValue) *Value {
	value := &Value{}
	_ = value.FromLiteralValue(*literalValue)
	return value
}
