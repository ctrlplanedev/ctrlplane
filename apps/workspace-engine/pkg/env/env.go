package env

import (
	"log"

	"github.com/kelseyhightower/envconfig"
)

var Config = config{}

func init() {
	if err := envconfig.Process("", &Config); err != nil {
		log.Fatal(err)
	}
}

type config struct {
	KafkaBrokers       string `envconfig:"KAFKA_BROKERS" default:"localhost:9092"`
	KafkaGroupID       string `envconfig:"KAFKA_GROUP_ID" default:"workspace-engine"`
	KafkaTopic         string `envconfig:"KAFKA_TOPIC" default:"workspace-events"`
	KafkaConsumerTopic string `envconfig:"KAFKA_CONSUMER_TOPIC" default:"workspace-events"`

	OTELServiceName          string `envconfig:"OTEL_SERVICE_NAME" default:"ctrlplane/workspace-engine"`
	OTELExporterOTLPEndpoint string `envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT" default:"localhost:4318"`

	GithubBotAppID      string `envconfig:"GITHUB_BOT_APP_ID" default:""`
	GithubBotPrivateKey string `envconfig:"GITHUB_BOT_PRIVATE_KEY" default:""`

	PostgresURL             string `envconfig:"POSTGRES_URL" default:"postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"`
	PostgresMaxPoolSize     int    `envconfig:"POSTGRES_MAX_POOL_SIZE" default:"50"`
	PostgresApplicationName string `envconfig:"POSTGRES_APPLICATION_NAME" default:"workspace-engine"`
}
