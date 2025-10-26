package config

import (
	"log"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all configuration for the router service
type Config struct {
	// Server configuration
	Host           string `envconfig:"HOST" default:"0.0.0.0"`
	Port           int    `envconfig:"PORT" default:"8080"`
	ManagementPort int    `envconfig:"MANAGEMENT_PORT" default:"9090"`

	// Kafka configuration
	KafkaBrokers string `envconfig:"KAFKA_BROKERS" default:"localhost:9092"`
	KafkaTopic   string `envconfig:"KAFKA_TOPIC" default:"workspace-events"`

	// Worker health configuration
	WorkerHeartbeatTimeout int `envconfig:"WORKER_HEARTBEAT_TIMEOUT" default:"30"`

	// OpenTelemetry configuration
	OTELServiceName          string `envconfig:"OTEL_SERVICE_NAME" default:"ctrlplane/workspace-engine-router"`
	OTELExporterOTLPEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:""`

	// Request timeout in seconds
	RequestTimeout int `envconfig:"REQUEST_TIMEOUT" default:"30"`
}

var Global Config

func init() {
	if err := envconfig.Process("", &Global); err != nil {
		log.Fatal(err)
	}
}

