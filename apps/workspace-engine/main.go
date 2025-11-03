package main

import (
	"context"
	"fmt"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"workspace-engine/pkg/config"
	dbpersistence "workspace-engine/pkg/db/persistence"
	"workspace-engine/pkg/events/handler/tick"
	"workspace-engine/pkg/kafka"
	"workspace-engine/pkg/registry"
	"workspace-engine/pkg/server"
	"workspace-engine/pkg/ticker"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

var (
	WorkerID = uuid.New().String()
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

	serviceName := config.Global.OTELServiceName
	endpoint := config.Global.OTELExporterOTLPEndpoint

	// Strip http:// or https:// prefix if present, as WithEndpoint() expects just host:port
	endpoint = stripScheme(endpoint)

	// Create resource with service name
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create OTLP HTTP exporter options
	opts := []otlptracehttp.Option{
		otlptracehttp.WithInsecure(), // Use HTTP instead of HTTPS
	}

	// Only set endpoint if it's explicitly provided
	if endpoint != "" {
		opts = append(opts, otlptracehttp.WithEndpoint(endpoint))
	}

	// Create OTLP trace exporter
	exporter, err := otlptracehttp.New(ctx, opts...)
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
	ctx := context.Background()
	store, err := dbpersistence.NewStore(ctx)
	if err != nil {
		log.Fatal("Failed to create Pebble store", "error", err)
		panic(err)
	}

	defer store.Close()

	manager.Configure(
		manager.WithPersistentStore(store),
		manager.WithWorkspaceCreateOptions(
			workspace.AddDefaultSystem(),
		),
	)

	// Initialize OpenTelemetry
	cleanup, err := initTracer()
	if err != nil {
		log.Fatal("Failed to initialize tracer", "error", err)
	}
	defer cleanup()

	host := config.Global.Host
	port := config.Global.Port
	addr := fmt.Sprintf("%s:%d", host, port)

	server := server.New()
	router := server.SetupRouter()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Initialize Kafka producer for ticker
	producer, err := kafka.NewProducer(kafka.Brokers)
	if err != nil {
		log.Fatal("Failed to create Kafka producer", "error", err)
		panic(err)
	}
	defer producer.Close()

	consumer, err := kafka.NewConsumer(kafka.Brokers, kafka.Topic)
	if err != nil {
		log.Fatal("Failed to create Kafka consumer", "error", err)
		panic(err)
	}
	defer consumer.Close()

	go ticker.Every(ctx, 5*time.Minute, func(ctx context.Context) {
		ids := manager.Workspaces().Keys()
		log.Info("Sending workspace ticks", "count", len(ids))
		for _, id := range ids {
			if err := tick.SendWorkspaceTick(ctx, producer, id); err != nil {
				log.Error("Failed to send workspace tick", "error", err)
			}
		}
	})

	// Use a channel to wait for consumer goroutine to finish
	consumerDone := make(chan struct{})
	go func() {
		defer close(consumerDone)
		log.Info("Kafka consumer started")
		if err := kafka.RunConsumer(ctx, consumer); err != nil {
			log.Error("received error from kafka consumer", "error", err)
			panic(err)
		}
	}()

	go func() {
		log.Info("Workspace engine server started", "address", addr)
		if err := router.Run(addr); err != nil {
			log.Fatal("Failed to serve", "error", err)
			panic(err)
		}
	}()

	// Initialize router registration client if configured
	var registryClient *registry.Client
	if config.Global.RouterURL != "" {
		workerID := uuid.New().String()
		registryClient = registry.NewClient(config.Global.RouterURL, workerID)
	}

	// Get assigned partitions from consumer
	assignedPartitions, err := consumer.GetAssignedPartitions()
	if err != nil || len(assignedPartitions) == 0 {
		log.Warn("Failed to get assigned partitions for router registration", "error", err, "partitions", assignedPartitions)
	} else {
		httpAddress := fmt.Sprintf("http://%s", addr)
		if config.Global.RegisterAddress != "" {
			httpAddress = config.Global.RegisterAddress
		}

		log.Info("Assigned partitions for router registration", "with_http_address", httpAddress, "partitions", assignedPartitions)
		// Build HTTP address for this worker

		// Register with router
		if err := registryClient.Register(ctx, httpAddress, assignedPartitions); err != nil {
			log.Error("Failed to register with router", "error", err)
		}

		go registryClient.StartHeartbeat(ctx, 15*time.Second)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Warn("Shutting down workspace engine...")

	// Cancel context to stop all goroutines
	cancel()

	// Shutdown steps in parallel: consumer, router unregister
	var shutdownWg sync.WaitGroup

	shutdownTimeout := time.NewTimer(10 * time.Second)
	defer shutdownTimeout.Stop()

	// 1. Wait for consumer goroutine to finish
	shutdownWg.Add(1)
	go func() {
		defer shutdownWg.Done()
		select {
		case <-consumerDone:
			log.Info("Consumer finished gracefully")
		case <-shutdownTimeout.C:
			log.Warn("Consumer shutdown timeout - forcing shutdown")
		}
	}()

	// 2. Unregister from router on shutdown
	if registryClient != nil {
		shutdownWg.Add(1)
		go func() {
			defer shutdownWg.Done()
			unregisterCtx, unregisterCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer unregisterCancel()
			if err := registryClient.Unregister(unregisterCtx); err != nil {
				log.Warn("Failed to unregister from router", "error", err)
			}
		}()
	}

	// Wait for all shutdown tasks to complete
	shutdownWg.Wait()

	log.Info("Shutting down workspace engine...")
}
