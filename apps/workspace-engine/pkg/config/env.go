package config

import (
	"log"
	"strings"

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
	Host      string `envconfig:"HOST"       default:"0.0.0.0"`
	Port      int    `envconfig:"PORT"       default:"8081"`
	PprofPort int    `envconfig:"PPROF_PORT" default:"6060"`

	// Kafka configuration
	KafkaBrokers       string `envconfig:"KAFKA_BROKERS"        default:"localhost:9092"`
	KafkaGroupID       string `envconfig:"KAFKA_GROUP_ID"       default:"workspace-engine"`
	KafkaTopic         string `envconfig:"KAFKA_TOPIC"          default:"workspace-events"`
	KafkaConsumerTopic string `envconfig:"KAFKA_CONSUMER_TOPIC" default:"workspace-events"`

	OTELServiceName          string `envconfig:"OTEL_SERVICE_NAME"           default:"ctrlplane/workspace-engine"`
	OTELExporterOTLPEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:"localhost:4318"`

	GithubBotAppID      string `envconfig:"GITHUB_BOT_APP_ID"      default:""`
	GithubBotPrivateKey string `envconfig:"GITHUB_BOT_PRIVATE_KEY" default:""`

	PostgresURL             string `envconfig:"POSTGRES_URL"              default:"postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"`
	PostgresMaxPoolSize     int    `envconfig:"POSTGRES_MAX_POOL_SIZE"    default:"50"`
	PostgresApplicationName string `envconfig:"POSTGRES_APPLICATION_NAME" default:"workspace-engine"`

	TraceTokenSecret string `envconfig:"TRACE_TOKEN_SECRET" default:"secret"`

	// Comma-separated list of services to run (empty means all).
	Services string `envconfig:"SERVICES" default:""`
}

// IsServiceEnabled reports whether kind appears in the SERVICES list.
// Returns true when the list is empty (all services enabled).
func IsServiceEnabled(kind string) bool {
	svcList := strings.TrimSpace(Global.Services)
	if svcList == "" {
		return true
	}
	for name := range strings.SplitSeq(svcList, ",") {
		if strings.TrimSpace(name) == kind {
			return true
		}
	}
	return false
}
