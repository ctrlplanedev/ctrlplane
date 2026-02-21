package kafka

import (
	"context"
	"time"

	"workspace-engine-router/pkg/config"

	"github.com/charmbracelet/log"
	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"golang.org/x/oauth2/google"
)

func IsGCPProvider() bool {
	return config.Global.KafkaSASLEnabled &&
		config.Global.KafkaSASLMechanism == "OAUTHBEARER" &&
		config.Global.KafkaSASLOAuthBearerProvider == "gcp"
}

func setGCPToken(client interface {
	SetOAuthBearerToken(token confluentkafka.OAuthBearerToken) error
}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	scope := config.Global.KafkaSASLOAuthBearerScope
	if scope == "" {
		scope = "https://www.googleapis.com/auth/cloud-platform"
	}

	ts, err := google.DefaultTokenSource(ctx, scope)
	if err != nil {
		return err
	}

	token, err := ts.Token()
	if err != nil {
		return err
	}

	if err := client.SetOAuthBearerToken(confluentkafka.OAuthBearerToken{
		TokenValue: token.AccessToken,
		Expiration: token.Expiry,
	}); err != nil {
		return err
	}

	log.Info("GCP OAuthBearer token set for admin client", "expires", token.Expiry.Format(time.RFC3339))
	return nil
}
