package config

import (
	"log"

	"github.com/kelseyhightower/envconfig"
)

var Global = Config{}

func init() {
	if err := envconfig.Process("", &Global); err != nil {
		log.Fatal(err)
	}
}

type Config struct {
	// Server configuration
	Host string `envconfig:"HOST" default:"0.0.0.0"`
	Port int    `envconfig:"PORT" default:"8082"`

	// OpenTelemetry configuration
	OTELServiceName          string `envconfig:"OTEL_SERVICE_NAME" default:"ctrlplane/relay"`
	OTELExporterOTLPEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:"localhost:4318"`
}
