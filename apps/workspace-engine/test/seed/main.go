package main

import (
	"encoding/json"
	"os"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func main() {
	// Parse command-line arguments to get bootstrap server URI, workspace ID, and file path
	var bootstrapServer, workspaceID, filePath string
	for i, arg := range os.Args {
		if arg == "--bootstrap-server" && i+1 < len(os.Args) {
			bootstrapServer = os.Args[i+1]
		}
		if arg == "--workspace-id" && i+1 < len(os.Args) {
			workspaceID = os.Args[i+1]
		}
		if arg == "--file" && i+1 < len(os.Args) {
			filePath = os.Args[i+1]
		}
	}
	if bootstrapServer == "" {
		bootstrapServer = "localhost:9092"
	}
	if workspaceID == "" {
		log.Fatalf("Must provide --workspace-id")
	}
	if filePath == "" {
		log.Fatalf("Must provide --file (path to file to seed from)")
	}

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": bootstrapServer,
	})
	if err != nil {
		log.Fatalf("Failed to create Kafka producer: %v", err)
	}
	defer producer.Close()

	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Failed to read file: %v", err)
	}

	type event struct {
		EventType   string          `json:"eventType"`
		WorkspaceID string          `json:"workspaceId"`
		Data        json.RawMessage `json:"data,omitempty"`
		Timestamp   int64           `json:"timestamp"`
	}

	dataJSON := make([]event, 0)
	if err := json.Unmarshal(data, &dataJSON); err != nil {
		log.Fatalf("Failed to unmarshal file: %v", err)
	}

	topic := "workspace-events"
	deliveryChan := make(chan kafka.Event, len(dataJSON))

	for _, event := range dataJSON {
		event.WorkspaceID = workspaceID
		
		eventJSON, err := json.Marshal(event)
		if err != nil {
			log.Fatalf("Failed to marshal event: %v", err)
		}

		err = producer.Produce(&kafka.Message{
			TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
			Value:          eventJSON,
		}, deliveryChan)
		if err != nil {
			log.Fatalf("Failed to produce message: %v", err)
		}
	}

	// Wait for all messages to be delivered
	for i := 0; i < len(dataJSON); i++ {
		e := <-deliveryChan
		m := e.(*kafka.Message)
		if m.TopicPartition.Error != nil {
			log.Errorf("Failed to deliver message: %v", m.TopicPartition.Error)
		} else {
			log.Infof("Delivered message to %v", m.TopicPartition)
		}
	}

	log.Infof("Successfully seeded workspace [%s] with %d events from file [%s]", workspaceID, len(dataJSON), filePath)
}