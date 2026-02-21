package config

import (
	"log"
	"time"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all configuration for the router service
type Config struct {
	// Server configuration
	Host           string `envconfig:"HOST" default:"0.0.0.0"`
	ProxyPort      int    `envconfig:"PROXY_PORT" default:"9090"`
	ManagementPort int    `envconfig:"MANAGEMENT_PORT" default:"9091"`

	// Kafka configuration
	KafkaBrokers     string `envconfig:"KAFKA_BROKERS" default:"localhost:9092"`
	KafkaTopic       string `envconfig:"KAFKA_TOPIC" default:"workspace-events"`
	KafkaSASLEnabled              bool   `envconfig:"KAFKA_SASL_ENABLED" default:"false"`
	KafkaSecurityProtocol         string `envconfig:"KAFKA_SECURITY_PROTOCOL" default:"SASL_SSL"`
	KafkaSASLMechanism            string `envconfig:"KAFKA_SASL_MECHANISM" default:"OAUTHBEARER"`
	KafkaSASLUsername             string `envconfig:"KAFKA_SASL_USERNAME" default:""`
	KafkaSASLPassword             string `envconfig:"KAFKA_SASL_PASSWORD" default:""`
	KafkaSASLOAuthBearerMethod    string `envconfig:"KAFKA_SASL_OAUTHBEARER_METHOD" default:"oidc"`
	KafkaSASLOAuthBearerTokenURL  string `envconfig:"KAFKA_SASL_OAUTHBEARER_TOKEN_URL" default:""`
	KafkaSASLOAuthBearerClientID  string `envconfig:"KAFKA_SASL_OAUTHBEARER_CLIENT_ID" default:""`
	KafkaSASLOAuthBearerClientSecret string `envconfig:"KAFKA_SASL_OAUTHBEARER_CLIENT_SECRET" default:""`
	KafkaSASLOAuthBearerScope     string `envconfig:"KAFKA_SASL_OAUTHBEARER_SCOPE" default:""`
	KafkaSASLOAuthBearerProvider  string `envconfig:"KAFKA_SASL_OAUTHBEARER_PROVIDER" default:"oidc"`

	// Worker health configuration
	WorkerHeartbeatTimeout time.Duration `envconfig:"WORKER_HEARTBEAT_TIMEOUT" default:"30s"`

	// OpenTelemetry configuration
	OTELServiceName          string `envconfig:"OTEL_SERVICE_NAME" default:"ctrlplane/workspace-engine-router"`
	OTELExporterOTLPEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:""`

	// Request timeout in seconds
	RequestTimeout time.Duration `envconfig:"REQUEST_TIMEOUT" default:"30s"`
}

var Global Config

func init() {
	if err := envconfig.Process("", &Global); err != nil {
		log.Fatal(err)
	}
}
