package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"workspace-engine-router/pkg/config"
	"workspace-engine-router/pkg/kafka"
	"workspace-engine-router/pkg/proxy"
	"workspace-engine-router/pkg/registry"
	"workspace-engine-router/pkg/router"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

// stripScheme removes http:// or https:// prefix from a URL
func stripScheme(endpoint string) string {
	if len(endpoint) == 0 {
		return endpoint
	}
	// Remove http:// prefix
	if len(endpoint) > 7 && endpoint[:7] == "http://" {
		return endpoint[7:]
	}
	// Remove https:// prefix
	if len(endpoint) > 8 && endpoint[:8] == "https://" {
		return endpoint[8:]
	}
	return endpoint
}

// initTracer initializes an OTLP exporter and registers it as a global tracer provider
func initTracer() (func(), error) {
	ctx := context.Background()

	// Only initialize if endpoint is configured
	if config.Global.OTELExporterOTLPEndpoint == "" {
		log.Info("OpenTelemetry tracing disabled (no endpoint configured)")
		return func() {}, nil
	}

	serviceName := config.Global.OTELServiceName
	endpoint := stripScheme(config.Global.OTELExporterOTLPEndpoint)

	// Create resource with service name
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create OTLP HTTP exporter
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithInsecure(),
		otlptracehttp.WithEndpoint(endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP trace exporter: %w", err)
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	log.Info("OpenTelemetry tracing initialized",
		"service", serviceName,
		"endpoint", endpoint)

	// Return cleanup function
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tp.Shutdown(ctx); err != nil {
			log.Error("Failed to shutdown tracer provider", "error", err)
		}
	}, nil
}

func main() {
	log.Info("Starting workspace-engine-router",
		"host", config.Global.Host,
		"routing_port", config.Global.ProxyPort,
		"management_port", config.Global.ManagementPort,
		"kafka_brokers", config.Global.KafkaBrokers,
		"kafka_topic", config.Global.KafkaTopic,
		"heartbeat_timeout", config.Global.WorkerHeartbeatTimeout)

	// Initialize OpenTelemetry
	cleanup, err := initTracer()
	if err != nil {
		log.Fatal("Failed to initialize tracer", "error", err)
	}
	defer cleanup()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create worker registry (in-memory for now)
	memoryRegistry := registry.NewInMemoryRegistry(config.Global.WorkerHeartbeatTimeout)
	var workerRegistry registry.WorkerRegistry = memoryRegistry

	// Create partition counter
	partitionCounter := kafka.NewPartitionCounter(
		config.Global.KafkaBrokers,
		config.Global.KafkaTopic,
	)

	// Initialize partition count
	partitionCount, err := partitionCounter.GetPartitionCount()
	if err != nil {
		log.Fatal("Failed to get initial partition count", "error", err)
	}
	log.Info("Initialized partition counter", "partitions", partitionCount)

	// Create reverse proxy
	reverseProxy := proxy.NewReverseProxy(config.Global.RequestTimeout)

	// Create router
	r := router.New(workerRegistry, partitionCounter, reverseProxy)

	// Setup routers
	managementRouter := r.SetupManagementRouter()
	routingRouter := r.SetupRoutingRouter()

	// Start cleanup goroutine for stale workers
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				removed := memoryRegistry.CleanupStaleWorkers()
				if removed > 0 {
					log.Info("Cleaned up stale workers", "count", removed)
				}
			}
		}
	}()

	// Start management HTTP server
	managementAddr := fmt.Sprintf("%s:%d", config.Global.Host, config.Global.ManagementPort)
	go func() {
		log.Info("Management server started", "address", managementAddr)
		if err := managementRouter.Run(managementAddr); err != nil {
			log.Fatal("Failed to start management server", "error", err)
		}
	}()

	// Start routing HTTP server
	routingAddr := fmt.Sprintf("%s:%d", config.Global.Host, config.Global.ProxyPort)
	go func() {
		log.Info("Routing server started", "address", routingAddr)
		if err := routingRouter.Run(routingAddr); err != nil {
			log.Fatal("Failed to start routing server", "error", err)
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info("Shutting down workspace-engine-router...")
}
