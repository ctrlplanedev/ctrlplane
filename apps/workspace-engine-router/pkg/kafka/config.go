package kafka

import (
	"fmt"
	"strings"
	"workspace-engine-router/pkg/config"

	"github.com/charmbracelet/log"
	kafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func BaseConfig() (*kafka.ConfigMap, error) {
	cfg := &kafka.ConfigMap{
		"bootstrap.servers": config.Global.KafkaBrokers,
	}
	if err := applySASL(cfg); err != nil {
		return nil, fmt.Errorf("invalid Kafka SASL configuration: %w", err)
	}
	return cfg, nil
}

func applySASL(cfg *kafka.ConfigMap) error {
	if !config.Global.KafkaSASLEnabled {
		return nil
	}

	mechanism := config.Global.KafkaSASLMechanism
	log.Info("Enabling SASL for Kafka", "mechanism", mechanism)

	_ = cfg.SetKey("security.protocol", config.Global.KafkaSecurityProtocol)
	_ = cfg.SetKey("sasl.mechanisms", mechanism)

	switch mechanism {
	case "PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512":
		var missing []string
		if config.Global.KafkaSASLUsername == "" {
			missing = append(missing, "KAFKA_SASL_USERNAME")
		}
		if config.Global.KafkaSASLPassword == "" {
			missing = append(missing, "KAFKA_SASL_PASSWORD")
		}
		if len(missing) > 0 {
			return fmt.Errorf("KAFKA_SASL_MECHANISM=%s requires: %s", mechanism, strings.Join(missing, ", "))
		}
		_ = cfg.SetKey("sasl.username", config.Global.KafkaSASLUsername)
		_ = cfg.SetKey("sasl.password", config.Global.KafkaSASLPassword)
	case "OAUTHBEARER":
		provider := config.Global.KafkaSASLOAuthBearerProvider
		switch provider {
		case "gcp":
			log.Info("Using GCP ADC for OAUTHBEARER tokens")
		case "oidc":
			if config.Global.KafkaSASLOAuthBearerTokenURL == "" {
				return fmt.Errorf("KAFKA_SASL_MECHANISM=OAUTHBEARER with provider=oidc requires: KAFKA_SASL_OAUTHBEARER_TOKEN_URL")
			}
			_ = cfg.SetKey("sasl.oauthbearer.method", config.Global.KafkaSASLOAuthBearerMethod)
			_ = cfg.SetKey("sasl.oauthbearer.client.id", config.Global.KafkaSASLOAuthBearerClientID)
			_ = cfg.SetKey("sasl.oauthbearer.client.secret", config.Global.KafkaSASLOAuthBearerClientSecret)
			_ = cfg.SetKey("sasl.oauthbearer.token.endpoint.url", config.Global.KafkaSASLOAuthBearerTokenURL)
			_ = cfg.SetKey("sasl.oauthbearer.scope", config.Global.KafkaSASLOAuthBearerScope)
		default:
			return fmt.Errorf("unknown KAFKA_SASL_OAUTHBEARER_PROVIDER: %s (supported: oidc, gcp)", provider)
		}
	default:
		return fmt.Errorf("unknown KAFKA_SASL_MECHANISM: %s (supported: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER)", mechanism)
	}

	return nil
}
