package kafka

import "github.com/confluentinc/confluent-kafka-go/v2/kafka"

type TopicPartition struct {
	Topic     string
	Partition int32
}

type KafkaProgress struct {
	// Last offset you have durably applied to your state.
	// Resume at Offset+1 on restart.
	LastApplied int64

	// Optional: last message timestamp or watermark if you want metrics.
	LastTimestamp int64
}

type KafkaProgressMap map[TopicPartition]KafkaProgress

func (m KafkaProgressMap) FromMessage(msg *kafka.Message) {
	topicPartition := TopicPartition{
		Topic:     *msg.TopicPartition.Topic,
		Partition: int32(msg.TopicPartition.Partition),
	}

	m[topicPartition] = KafkaProgress{
		LastApplied:   int64(msg.TopicPartition.Offset),
		LastTimestamp: int64(msg.Timestamp.Unix()),
	}
}
