package confluent

import (
	"context"
	"time"

	"workspace-engine/pkg/config"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"golang.org/x/oauth2/google"
)

type oauthBearerClient interface {
	SetOAuthBearerToken(token kafka.OAuthBearerToken) error
	SetOAuthBearerTokenFailure(errstr string) error
}

func IsGCPProvider() bool {
	return config.Global.KafkaSASLEnabled &&
		config.Global.KafkaSASLMechanism == "OAUTHBEARER" &&
		config.Global.KafkaSASLOAuthBearerProvider == "gcp"
}

func handleOAuthBearerTokenRefresh(client oauthBearerClient) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	scope := config.Global.KafkaSASLOAuthBearerScope
	if scope == "" {
		scope = "https://www.googleapis.com/auth/cloud-platform"
	}

	ts, err := google.DefaultTokenSource(ctx, scope)
	if err != nil {
		log.Error("Failed to create GCP token source", "error", err)
		_ = client.SetOAuthBearerTokenFailure(err.Error())
		return
	}

	token, err := ts.Token()
	if err != nil {
		log.Error("Failed to get GCP access token", "error", err)
		_ = client.SetOAuthBearerTokenFailure(err.Error())
		return
	}

	if err := client.SetOAuthBearerToken(kafka.OAuthBearerToken{
		TokenValue: token.AccessToken,
		Expiration: token.Expiry,
	}); err != nil {
		log.Error("Failed to set OAuthBearer token", "error", err)
		return
	}

	log.Info("GCP OAuthBearer token refreshed", "expires", token.Expiry.Format(time.RFC3339))
}
