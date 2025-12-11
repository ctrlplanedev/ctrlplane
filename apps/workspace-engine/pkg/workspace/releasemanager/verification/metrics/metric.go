package metrics

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider/datadog"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider/http"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider/sleep"

	"github.com/charmbracelet/log"
)

// CreateProvider creates a provider from the metric's provider configuration
func CreateProvider(providerCfg oapi.MetricProvider) (provider.Provider, error) {
	discriminator, err := providerCfg.Discriminator()
	if err != nil {
		return nil, fmt.Errorf("failed to get provider discriminator: %w", err)
	}

	switch discriminator {
	case "http":
		httpProvider, err := providerCfg.AsHTTPMetricProvider()
		if err != nil {
			return nil, fmt.Errorf("failed to parse HTTP provider: %w", err)
		}
		return http.NewFromOAPI(httpProvider)

	case "sleep":
		sleepProvider, err := providerCfg.AsSleepMetricProvider()
		if err != nil {
			return nil, fmt.Errorf("failed to parse sleep provider: %w", err)
		}
		return sleep.NewFromOAPI(sleepProvider)

	case "datadog":
		datadogProvider, err := providerCfg.AsDatadogMetricProvider()
		if err != nil {
			return nil, fmt.Errorf("failed to parse Datadog provider: %w", err)
		}
		return datadog.NewFromOAPI(datadogProvider)

	default:
		return nil, fmt.Errorf("unsupported provider type: %s", discriminator)
	}
}

// Measure takes a measurement using the metric status's configuration and evaluates the success condition
func Measure(ctx context.Context, metric *oapi.VerificationMetricStatus, providerCtx *provider.ProviderContext) (oapi.VerificationMeasurement, error) {
	// Create provider
	p, err := CreateProvider(metric.Provider)
	if err != nil {
		return oapi.VerificationMeasurement{}, fmt.Errorf("failed to create provider: %w", err)
	}

	// Take measurement
	measuredAt, data, err := p.Measure(ctx, providerCtx)
	if err != nil {
		return oapi.VerificationMeasurement{}, err
	}

	message := "Measurement completed"

	// Evaluate success condition
	successEvaluator, err := NewEvaluator(metric.SuccessCondition)
	if err != nil {
		log.Error("Failed to create evaluator", "error", err)
		message = fmt.Sprintf("Failed to create evaluator: %s", err.Error())
		return oapi.VerificationMeasurement{}, err
	}

	passed, err := successEvaluator.Evaluate(data)
	if err != nil {
		message = fmt.Sprintf("Measurement failed: %s", err.Error())
	}

	if !passed {
		return oapi.VerificationMeasurement{
			Message:    &message,
			Passed:     passed,
			Data:       &data,
			MeasuredAt: measuredAt,
		}, nil
	}

	if metric.FailureCondition == nil {
		return oapi.VerificationMeasurement{
			Message:    &message,
			Passed:     passed,
			Data:       &data,
			MeasuredAt: measuredAt,
		}, nil
	}

	// Evaluate failure condition
	failureEvaluator, err := NewEvaluator(*metric.FailureCondition)
	if err != nil {
		log.Error("Failed to create evaluator", "error", err)
		message = fmt.Sprintf("Failed to create evaluator: %s", err.Error())
		return oapi.VerificationMeasurement{}, err
	}

	failed, err := failureEvaluator.Evaluate(data)
	if err != nil {
		message = fmt.Sprintf("Measurement failed: %s", err.Error())
	}

	return oapi.VerificationMeasurement{
		Message:    &message,
		Passed:     !failed,
		Data:       &data,
		MeasuredAt: measuredAt,
	}, nil
}
