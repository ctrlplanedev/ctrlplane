package kafka

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
