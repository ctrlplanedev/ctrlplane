package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"workspace-engine/pkg/config"
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

	slog.Info("OpenTelemetry tracing initialized",
		"service", serviceName,
		"endpoint", endpoint)

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tp.Shutdown(ctx); err != nil {
			slog.Error("Failed to shutdown tracer provider", "error", err)
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

	slog.Info("OpenTelemetry metrics initialized",
		"service", serviceName,
		"endpoint", endpoint,
		"export_interval", "10s")

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := mp.Shutdown(ctx); err != nil {
			slog.Error("Failed to shutdown meter provider", "error", err)
		}
	}, nil
}

func parseLogLevel(s string) slog.Level {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "DEBUG":
		return slog.LevelDebug
	case "WARN", "WARNING":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func initLogger() (func(), error) {
	ctx := context.Background()

	serviceName := config.Global.OTELServiceName
	endpoint := stripScheme(config.Global.OTELExporterOTLPEndpoint)
	level := parseLogLevel(config.Global.OTELLogLevel)

	res, err := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceNameKey.String(serviceName)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	opts := []otlploghttp.Option{otlploghttp.WithInsecure()}
	if endpoint != "" {
		opts = append(opts, otlploghttp.WithEndpoint(endpoint))
	}

	exporter, err := otlploghttp.New(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP log exporter: %w", err)
	}

	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
		sdklog.WithResource(res),
	)

	otelHandler := newLevelHandler(level, otelslog.NewHandler(serviceName, otelslog.WithLoggerProvider(lp)))

	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})

	slog.SetDefault(slog.New(newTeeHandler(stderrHandler, otelHandler)))

	slog.Info("OpenTelemetry logging initialized",
		"service", serviceName,
		"endpoint", endpoint,
		"level", level.String())

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := lp.Shutdown(ctx); err != nil {
			slog.Error("Failed to shutdown logger provider", "error", err)
		}
	}, nil
}
