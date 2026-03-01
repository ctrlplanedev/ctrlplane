package metrics

import (
	"encoding/json"
	"time"
)

type MeasurementStatus string

const (
	StatusPassed       MeasurementStatus = "passed"
	StatusFailed       MeasurementStatus = "failed"
	StatusInconclusive MeasurementStatus = "inconclusive"
)

type VerificationStatus string

const (
	VerificationRunning VerificationStatus = "running"
	VerificationPassed  VerificationStatus = "passed"
	VerificationFailed  VerificationStatus = "failed"
)

// VerificationMetric mirrors the verification_metric DB table with its
// associated measurements pre-loaded.
type VerificationMetric struct {
	ID               string
	Name             string
	Provider         json.RawMessage
	IntervalSeconds  int32
	Count            int32
	SuccessCondition string
	SuccessThreshold *int32
	FailureCondition *string
	FailureThreshold *int32
	Measurements     []Measurement
}

// Measurement mirrors the verification_metric_measurement DB table.
type Measurement struct {
	ID         string
	MetricID   string
	Data       map[string]any
	MeasuredAt time.Time
	Message    string
	Status     MeasurementStatus
}

func (vm *VerificationMetric) Interval() time.Duration {
	return time.Duration(vm.IntervalSeconds) * time.Second
}

func (vm *VerificationMetric) FailureLimit() int {
	if vm.FailureThreshold == nil {
		return 0
	}
	return int(*vm.FailureThreshold)
}
