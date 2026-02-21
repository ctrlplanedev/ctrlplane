package main

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/config"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func stripScheme(endpoint string) string {
	if len(endpoint) == 0 {
		return endpoint
	}
	if len(endpoint) > 7 && endpoint[:7] == "http://" {
		return endpoint[7:]
	}
	if len(endpoint) > 8 && endpoint[:8] == "https://" {
		return endpoint[8:]
	}
	return endpoint
}

func initTracer() (func(), error) {
	ctx := context.Background()

	serviceName := config.Global.OTELServiceName
	endpoint := config.Global.OTELExporterOTLPEndpoint

	// WithEndpoint() expects just host:port
	endpoint = stripScheme(endpoint)

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	opts := []otlptracehttp.Option{
		otlptracehttp.WithInsecure(),
	}

	if endpoint != "" {
		opts = append(opts, otlptracehttp.WithEndpoint(endpoint))
	}

	exporter, err := otlptracehttp.New(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP trace exporter: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	otel.SetTracerProvider(tp)

	log.Info("OpenTelemetry tracing initialized",
		"service", serviceName,
		"endpoint", endpoint)

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tp.Shutdown(ctx); err != nil {
			log.Error("Failed to shutdown tracer provider", "error", err)
		}
	}, nil
}

func initMetrics() (func(), error) {
	ctx := context.Background()

	serviceName := config.Global.OTELServiceName
	endpoint := config.Global.OTELExporterOTLPEndpoint

	endpoint = stripScheme(endpoint)

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	opts := []otlpmetrichttp.Option{
		otlpmetrichttp.WithInsecure(),
	}

	if endpoint != "" {
		opts = append(opts, otlpmetrichttp.WithEndpoint(endpoint))
	}

	exporter, err := otlpmetrichttp.New(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP metrics exporter: %w", err)
	}

	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter,
			sdkmetric.WithInterval(10*time.Second),
		)),
		sdkmetric.WithResource(res),
	)

	otel.SetMeterProvider(mp)

	err = runtime.Start(runtime.WithMinimumReadMemStatsInterval(time.Second))
	if err != nil {
		return nil, fmt.Errorf("failed to start runtime metrics: %w", err)
	}

	log.Info("OpenTelemetry metrics initialized",
		"service", serviceName,
		"endpoint", endpoint,
		"export_interval", "10s")

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := mp.Shutdown(ctx); err != nil {
			log.Error("Failed to shutdown meter provider", "error", err)
		}
	}, nil
}
