package kafka

import (
	"fmt"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
)

func NewProducer() (messaging.Producer, error) {
	cfg, err := confluent.BaseProducerConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to build producer config: %w", err)
	}
	return confluent.NewConfluent(Brokers).CreateProducer(Topic, cfg)
}
