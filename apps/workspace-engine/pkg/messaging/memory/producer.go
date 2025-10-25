package memory

import (
	"fmt"
	"sync"

	"workspace-engine/pkg/messaging"

	"github.com/charmbracelet/log"
)

// Producer is an in-memory implementation of messaging.Producer
type Producer struct {
	mu      sync.RWMutex
	broker  *Broker
	topic   *Topic
	pending int
	closed  bool
}

// Ensure Producer implements messaging.Producer
var _ messaging.Producer = (*Producer)(nil)

// NewProducer creates a new in-memory producer for a specific topic
func NewProducer(broker *Broker, topic string) *Producer {
	t := broker.GetOrCreateTopic(topic)
	log.Info("Memory producer created", "topic", topic)
	return &Producer{
		broker: broker,
		topic:  t,
	}
}

func (p *Producer) PublishToPartition(key []byte, value []byte, partition int32) error {
	return p.Publish(key, value)
}

// Publish publishes a message to the topic
func (p *Producer) Publish(key []byte, value []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return fmt.Errorf("producer is closed")
	}

	p.pending++
	err := p.topic.Publish(key, value)
	if err != nil {
		p.pending--
		return err
	}

	// Message published successfully
	p.pending--
	log.Debug("Message published", "key", string(key), "valueSize", len(value))
	return nil
}

// Flush waits for all pending messages to be delivered
// For in-memory implementation, this is essentially a no-op since publishes are synchronous
// Returns the number of messages still pending
func (p *Producer) Flush(timeoutMs int) int {
	p.mu.RLock()
	defer p.mu.RUnlock()

	log.Debug("Flushing producer", "pending", p.pending)
	return p.pending
}

// Close closes the producer
func (p *Producer) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}

	if p.pending > 0 {
		log.Warn("Producer closed with pending messages", "pending", p.pending)
	}

	p.closed = true
	log.Info("Memory producer closed")
	return nil
}
