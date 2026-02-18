package kafka

import (
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
)

func NewProducer(brokers string) (messaging.Producer, error) {
	return confluent.NewConfluent(brokers).CreateProducer(Topic, confluent.BaseProducerConfig())
}
