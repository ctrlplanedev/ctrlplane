package relay

import (
	"context"
	"fmt"
	"net/http"
	"relay/pkg/config"
	"relay/pkg/httphandler"
	"time"

	"github.com/charmbracelet/log"
	"github.com/gorilla/websocket"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.16.0"

	"github.com/ctrlplanedev/relay/server/hub"
)

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

func initTracer() (func(), error) {
	ctx := context.Background()

	// Only initialize if endpoint is configured
	if config.Global.OTELExporterOTLPEndpoint == "" {
		log.Info("OpenTelemetry tracing disabled (no endpoint configured)")
		return func() {}, nil
	}

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
	// Initialize OpenTelemetry Tracing
	cleanupTracer, err := initTracer()
	if err != nil {
		log.Fatal("Failed to initialize tracer", "error", err)
	}
	defer cleanupTracer()

	h := hub.New()
	
	srv := httphandler.NewServer(h)

	http.HandleFunc("/agent/connect", srv.HandleAgent)
	http.HandleFunc("/client/connect", srv.HandleClient)
	http.HandleFunc("/api/agents", srv.HandleListAgents)

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Allow all connections by default
			return true
		},
	}

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Println("WebSocket upgrade error:", err)
			return
		}
		defer conn.Close()

		fmt.Println("New WebSocket connection established")

		for {
			msgType, msg, err := conn.ReadMessage()
			if err != nil {
				fmt.Println("read error:", err)
				break
			}
			fmt.Printf("Received: %s\n", msg)

			// Echo the message back to the client
			err = conn.WriteMessage(msgType, msg)
			if err != nil {
				fmt.Println("write error:", err)
				break
			}
		}
	})

	go func() {
		addr := ":8082"
		fmt.Println("WebSocket server started at", addr)
		if err := http.ListenAndServe(addr, nil); err != nil {
			fmt.Println("ListenAndServe error:", err)
		}
	}()

	if err := http.ListenAndServe(fmt.Sprintf(":%d", config.Global.Port), nil); err != nil {
		fmt.Println("ListenAndServe error:", err)
	}
}
