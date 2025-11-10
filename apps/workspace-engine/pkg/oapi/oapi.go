//go:generate sh -c "jsonnetfmt -i ../../oapi/spec/**/*.jsonnet"
//go:generate sh -c "jsonnet ../../oapi/spec/main.jsonnet > ../../oapi/openapi.json"
//go:generate go tool oapi-codegen -config ../../oapi/cfg.yaml ../../oapi/openapi.json

package oapi

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

func ReleaseTargetFromKey(key string) *ReleaseTarget {
	parts := strings.Split(key, "-")
	if len(parts) != 3 {
		return nil
	}
	return &ReleaseTarget{
		ResourceId:    parts[0],
		EnvironmentId: parts[1],
		DeploymentId:  parts[2],
	}
}

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
	return x.VersionId + x.UserId
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
func (vms *VerificationMetricSpec) GetInterval() (time.Duration, error) {
	return time.ParseDuration(vms.Interval)
}

// GetFailureLimit returns the failure limit, defaulting to 0 if not set
func (vms *VerificationMetricSpec) GetFailureLimit() int {
	if vms.FailureLimit == nil {
		return 0
	}
	return *vms.FailureLimit
}

// GetInterval parses and returns the interval duration from the metric status
func (vms *VerificationMetricStatus) GetInterval() (time.Duration, error) {
	return time.ParseDuration(vms.Interval)
}

// GetFailureLimit returns the failure limit, defaulting to 0 if not set
func (vms *VerificationMetricStatus) GetFailureLimit() int {
	if vms.FailureLimit == nil {
		return 0
	}
	return *vms.FailureLimit
}

// Status computes the overall verification status from its metrics
func (rv *ReleaseVerification) Status() ReleaseVerificationStatus {
	if len(rv.Metrics) == 0 {
		return ReleaseVerificationStatusRunning
	}

	allCompleted := true
	anyFailed := false

	for _, metric := range rv.Metrics {
		// Check if this metric has hit its failure limit
		failureLimit := metric.GetFailureLimit()
		failedCount := 0
		for _, m := range metric.Measurements {
			if !m.Passed {
				failedCount++
			}
		}

		if failureLimit > 0 && failedCount >= failureLimit {
			return ReleaseVerificationStatusFailed
		}

		// Check if metric is complete
		if len(metric.Measurements) < metric.Count {
			allCompleted = false
		} else {
			// Metric is complete, check if it failed
			if failedCount > 0 {
				anyFailed = true
			}
		}
	}

	// If any metric is incomplete, still running
	if !allCompleted {
		return ReleaseVerificationStatusRunning
	}

	// All metrics complete
	if anyFailed {
		return ReleaseVerificationStatusFailed
	}

	return ReleaseVerificationStatusPassed
}

// StartedAt returns the earliest measurement time across all metrics
func (rv *ReleaseVerification) StartedAt() *time.Time {
	var earliest *time.Time

	for _, metric := range rv.Metrics {
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
func (rv *ReleaseVerification) CompletedAt() *time.Time {
	if rv.Status() == ReleaseVerificationStatusRunning {
		return nil
	}

	var latest *time.Time

	for _, metric := range rv.Metrics {
		if len(metric.Measurements) > 0 {
			lastMeasurement := metric.Measurements[len(metric.Measurements)-1].MeasuredAt
			if latest == nil || lastMeasurement.After(*latest) {
				latest = &lastMeasurement
			}
		}
	}

	return latest
}
