package config

import (
	"log"
	"runtime"
	"strconv"
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
	Host      string `default:"0.0.0.0" envconfig:"HOST"`
	Port      int    `default:"8081"    envconfig:"PORT"`
	PprofPort int    `default:"6060"    envconfig:"PPROF_PORT"`

	// Kafka configuration
	KafkaBrokers       string `default:"localhost:9092"   envconfig:"KAFKA_BROKERS"`
	KafkaGroupID       string `default:"workspace-engine" envconfig:"KAFKA_GROUP_ID"`
	KafkaTopic         string `default:"workspace-events" envconfig:"KAFKA_TOPIC"`
	KafkaConsumerTopic string `default:"workspace-events" envconfig:"KAFKA_CONSUMER_TOPIC"`

	OTELServiceName          string `default:"ctrlplane/workspace-engine" envconfig:"OTEL_SERVICE_NAME"`
	OTELExporterOTLPEndpoint string `default:"localhost:4318"             envconfig:"OTEL_EXPORTER_OTLP_ENDPOINT"`

	GithubBotAppID      string `default:"" envconfig:"GITHUB_BOT_APP_ID"`
	GithubBotPrivateKey string `default:"" envconfig:"GITHUB_BOT_PRIVATE_KEY"`

	PostgresURL             string `default:"postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane" envconfig:"POSTGRES_URL"`
	PostgresMaxPoolSize     int    `default:"50"                                                        envconfig:"POSTGRES_MAX_POOL_SIZE"`
	PostgresApplicationName string `default:"workspace-engine"                                          envconfig:"POSTGRES_APPLICATION_NAME"`

	TFEToken         string `default:"" envconfig:"TFE_TOKEN"`
	TFEWebhookSecret string `default:"" envconfig:"TFE_WEBHOOK_SECRET"`

	TraceTokenSecret string `default:"secret" envconfig:"TRACE_TOKEN_SECRET"`

	// Comma-separated list of services to run (empty means all).
	Services string `default:"" envconfig:"SERVICES"`

	ReconcileMaxConcurrency          int    `default:"0" envconfig:"RECONCILE_MAX_CONCURRENCY"`
	ReconcileMaxConcurrencyOverrides string `default:""  envconfig:"RECONCILE_MAX_CONCURRENCY_OVERRIDES"`
}

// GetMaxConcurrency returns the max concurrency for a given service kind.
// Checks per-service overrides first, then the global setting, then GOMAXPROCS.
func GetMaxConcurrency(kind string) int {
	if overrides := strings.TrimSpace(Global.ReconcileMaxConcurrencyOverrides); overrides != "" {
		for entry := range strings.SplitSeq(overrides, ",") {
			k, v, ok := strings.Cut(strings.TrimSpace(entry), "=")
			if ok && strings.TrimSpace(k) == kind {
				if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 {
					return n
				}
			}
		}
	}
	if Global.ReconcileMaxConcurrency > 0 {
		return Global.ReconcileMaxConcurrency
	}
	return runtime.GOMAXPROCS(0)
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
