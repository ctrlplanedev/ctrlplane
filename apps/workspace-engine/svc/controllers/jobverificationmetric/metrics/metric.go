package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider/datadog"
	httpProvider "workspace-engine/svc/controllers/jobverificationmetric/metrics/provider/http"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider/prometheus"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider/sleep"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider/terraformcloud"

	"github.com/charmbracelet/log"
)

// CreateProvider creates a provider from raw JSONB provider configuration
// stored in the verification_metric.provider column.
func CreateProvider(providerJSON json.RawMessage) (provider.Provider, error) {
	var typed struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(providerJSON, &typed); err != nil {
		return nil, fmt.Errorf("failed to parse provider type: %w", err)
	}

	switch typed.Type {
	case "http":
		return httpProvider.NewFromJSON(providerJSON)
	case "sleep":
		return sleep.NewFromJSON(providerJSON)
	case "datadog":
		return datadog.NewFromJSON(providerJSON)
	case "prometheus":
		return prometheus.NewFromJSON(providerJSON)
	case "terraformCloudRun":
		return terraformcloud.NewFromJSON(providerJSON)
	default:
		return nil, fmt.Errorf("unsupported provider type: %s", typed.Type)
	}
}

// Measure takes a measurement using the metric's provider configuration
// and evaluates the success/failure conditions.
func Measure(ctx context.Context, metric *VerificationMetric, providerCtx *provider.ProviderContext) (Measurement, error) {
	p, err := CreateProvider(metric.Provider)
	if err != nil {
		return Measurement{}, fmt.Errorf("failed to create provider: %w", err)
	}

	measuredAt, data, err := p.Measure(ctx, providerCtx)
	if err != nil {
		return Measurement{}, err
	}

	message := "Measurement completed"
	hasFailureCondition := metric.FailureCondition != nil && *metric.FailureCondition != ""

	if hasFailureCondition {
		failureEvaluator, err := NewEvaluator(*metric.FailureCondition)
		if err != nil {
			log.Error("Failed to create failure evaluator", "error", err)
			return Measurement{}, err
		}

		failed, err := failureEvaluator.Evaluate(data)
		if err != nil {
			message = fmt.Sprintf("Failure evaluation failed: %s", err.Error())
		}

		if failed {
			message = "Failure condition met"
			return Measurement{
				MetricID:   metric.ID,
				Message:    message,
				Status:     StatusFailed,
				Data:       data,
				MeasuredAt: measuredAt,
			}, nil
		}
	}

	successEvaluator, err := NewEvaluator(metric.SuccessCondition)
	if err != nil {
		log.Error("Failed to create success evaluator", "error", err)
		return Measurement{}, err
	}

	passed, err := successEvaluator.Evaluate(data)
	if err != nil {
		message = fmt.Sprintf("Success evaluation failed: %s", err.Error())
	}

	if passed {
		message = "Success condition met"
		return Measurement{
			MetricID:   metric.ID,
			Message:    message,
			Status:     StatusPassed,
			Data:       data,
			MeasuredAt: measuredAt,
		}, nil
	}

	if hasFailureCondition {
		message = "Waiting for success or failure condition"
		return Measurement{
			MetricID:   metric.ID,
			Message:    message,
			Status:     StatusInconclusive,
			Data:       data,
			MeasuredAt: measuredAt,
		}, nil
	}

	message = "Success condition not met"
	return Measurement{
		MetricID:   metric.ID,
		Message:    message,
		Status:     StatusFailed,
		Data:       data,
		MeasuredAt: measuredAt,
	}, nil
}
