package kafka

import (
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type ProducerMock struct {
	queue *MessageQueue
	topic string
}

func NewProducerMock(queue *MessageQueue) *ProducerMock {
	return &ProducerMock{
		queue: queue,
		topic: "workspace-events",
	}
}

// Produce simulates the async enqueueing of a message and asynchronously sends a delivery report on deliveryChan if specified,
// similar to the real kafka.Producer.Produce behavior.
//
// This is safe for tests that don't need full concurrency guarantees.
func (p *ProducerMock) Produce(msg *kafka.Message, deliveryChan chan kafka.Event) error {
	p.queue.Push(msg)
	// If a deliveryChan is provided, simulate a successful delivery asynchronously.
	if deliveryChan != nil {
		go func(m *kafka.Message, ch chan kafka.Event) {
			// Simulate kafka behavior by returning the message on deliveryChan.
			// Set TopicPartition.Error to nil (delivery success).
			cp := *m
			cp.TopicPartition.Error = nil
			ch <- &cp
		}(msg, deliveryChan)
	}
	return nil
}

