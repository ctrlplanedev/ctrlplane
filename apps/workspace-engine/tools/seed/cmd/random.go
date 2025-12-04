package cmd

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var (
	randomSeed int64

	// Resource kinds to randomly choose from
	resourceKinds = []string{
		"KubernetesCluster",
		"KubernetesNamespace",
		"KubernetesPod",
		"KubernetesDeployment",
		"KubernetesService",
		"AmazonWebServicesAccount",
		"EC2Instance",
		"RDSDatabase",
		"S3Bucket",
		"LambdaFunction",
		"AzureSubscription",
		"AzureVirtualMachine",
		"AzureStorageAccount",
		"GoogleCloudProject",
		"GCEInstance",
		"GKECluster",
		"CloudSQLDatabase",
	}

	// Regions to randomly choose from
	regions = []string{
		"us-east-1", "us-east-2", "us-west-1", "us-west-2",
		"eu-west-1", "eu-west-2", "eu-central-1", "eu-north-1",
		"ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-south-1",
		"ca-central-1", "sa-east-1",
	}

	// Environments to randomly choose from
	environments = []string{"production", "staging", "development", "qa", "uat"}

	// Teams to randomly choose from
	teams = []string{"platform", "backend", "frontend", "data", "ml", "security", "devops"}

	// Name prefixes
	namePrefixes = []string{"web", "api", "worker", "db", "cache", "queue", "storage", "compute", "analytics"}

	// Name suffixes
	nameSuffixes = []string{"service", "cluster", "instance", "pod", "deployment", "app", "server"}
)

type Event struct {
	EventType   string          `json:"eventType"`
	WorkspaceID string          `json:"workspaceId"`
	Data        json.RawMessage `json:"data,omitempty"`
	Timestamp   int64           `json:"timestamp"`
}

type Resource struct {
	ID          string                 `json:"id"`
	WorkspaceID string                 `json:"workspaceId"`
	Name        string                 `json:"name"`
	Kind        string                 `json:"kind"`
	Version     string                 `json:"version"`
	Identifier  string                 `json:"identifier"`
	CreatedAt   string                 `json:"createdAt"`
	Config      map[string]interface{} `json:"config"`
	Metadata    map[string]string      `json:"metadata"`
}

var randomCmd = &cobra.Command{
	Use:   "random",
	Short: "Generate random workspace data",
	Long:  `Generate and seed random workspace data.`,
}

var randomResourcesCmd = &cobra.Command{
	Use:   "resources [count]",
	Short: "Generate random resources",
	Long:  `Generate and seed a specified number of random resources with realistic metadata.`,
	Args:  cobra.ExactArgs(1),
	Run:   runRandomResources,
}

func init() {
	rootCmd.AddCommand(randomCmd)
	randomCmd.AddCommand(randomResourcesCmd)

	randomCmd.PersistentFlags().Int64Var(&randomSeed, "seed", 0, "Random seed for reproducible generation (0 for current time)")
}

func randomElement(slice []string) string {
	return slice[rand.Intn(len(slice))]
}

func randomInt(min, max int) int {
	return rand.Intn(max-min) + min
}

func randomIntFromSlice(values []int) int {
	return values[rand.Intn(len(values))]
}

func randomBool() bool {
	return rand.Intn(2) == 1
}

func generateRandomResource(workspaceID string, index int) *Resource {
	kind := randomElement(resourceKinds)
	region := randomElement(regions)
	env := randomElement(environments)
	team := randomElement(teams)

	namePrefix := randomElement(namePrefixes)
	nameSuffix := randomElement(nameSuffixes)
	name := fmt.Sprintf("%s-%s-%s-%d", namePrefix, nameSuffix, env, index)

	id := uuid.New().String()
	identifier := fmt.Sprintf("resource/%s/%s/%s", region, kind, id)

	resource := &Resource{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        name,
		Kind:        kind,
		Version:     "ctrlplane.dev/v1",
		Identifier:  identifier,
		CreatedAt:   time.Now().Add(-time.Duration(randomInt(0, 30)) * 24 * time.Hour).Format(time.RFC3339),
		Config:      make(map[string]interface{}),
		Metadata:    make(map[string]string),
	}

	// Add common metadata
	resource.Metadata["region"] = region
	resource.Metadata["environment"] = env
	resource.Metadata["team"] = team
	resource.Metadata["managed"] = fmt.Sprintf("%v", randomBool())
	resource.Metadata["cost-center"] = fmt.Sprintf("cc-%d", randomInt(1000, 9999))

	// Add kind-specific metadata and config
	switch {
	case kind == "KubernetesCluster" || kind == "GKECluster":
		resource.Config["nodeCount"] = randomInt(1, 20)
		resource.Config["version"] = fmt.Sprintf("1.%d.%d", randomInt(25, 29), randomInt(0, 5))
		resource.Config["autoscaling"] = randomBool()
		resource.Metadata["cluster-type"] = randomElement([]string{"production", "development", "testing"})

	case kind == "KubernetesPod" || kind == "KubernetesDeployment":
		resource.Config["replicas"] = randomInt(1, 10)
		resource.Config["cpuRequest"] = fmt.Sprintf("%dm", randomInt(100, 2000))
		resource.Config["memoryRequest"] = fmt.Sprintf("%dMi", randomInt(128, 4096))
		resource.Metadata["namespace"] = fmt.Sprintf("%s-ns", env)
		resource.Metadata["app"] = namePrefix

	case kind == "EC2Instance" || kind == "AzureVirtualMachine" || kind == "GCEInstance":
		instanceTypes := []string{"t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large", "m5.xlarge"}
		resource.Config["instanceType"] = randomElement(instanceTypes)
		resource.Config["vcpus"] = randomInt(1, 16)
		resource.Config["memoryGb"] = randomInt(1, 64)
		resource.Config["publicIP"] = fmt.Sprintf("52.%d.%d.%d", randomInt(0, 255), randomInt(0, 255), randomInt(0, 255))
		resource.Metadata["os"] = randomElement([]string{"ubuntu-22.04", "amazon-linux-2", "rhel-8", "windows-server-2022"})

	case kind == "RDSDatabase" || kind == "CloudSQLDatabase":
		resource.Config["engine"] = randomElement([]string{"postgres", "mysql", "mariadb"})
		resource.Config["version"] = fmt.Sprintf("%d.%d", randomInt(10, 15), randomInt(0, 5))
		resource.Config["instanceClass"] = randomElement([]string{"db.t3.micro", "db.t3.small", "db.m5.large"})
		resource.Config["allocatedStorageGb"] = randomInt(20, 1000)
		resource.Config["multiAZ"] = randomBool()
		resource.Metadata["backup-retention-days"] = fmt.Sprintf("%d", randomInt(7, 30))

	case kind == "S3Bucket" || kind == "AzureStorageAccount":
		resource.Config["sizeGb"] = randomInt(1, 10000)
		resource.Config["objectCount"] = randomInt(0, 1000000)
		resource.Config["versioning"] = randomBool()
		resource.Config["encryption"] = "AES256"
		resource.Metadata["lifecycle-policy"] = randomElement([]string{"enabled", "disabled"})

	case kind == "LambdaFunction":
		resource.Config["runtime"] = randomElement([]string{"nodejs18.x", "python3.11", "go1.x", "java17"})
		resource.Config["memoryMb"] = randomIntFromSlice([]int{128, 256, 512, 1024, 2048, 3008})
		resource.Config["timeoutSeconds"] = randomInt(3, 900)
		resource.Config["invocations24h"] = randomInt(0, 100000)
		resource.Metadata["trigger"] = randomElement([]string{"api-gateway", "s3", "dynamodb", "sqs", "eventbridge"})
	}

	// Add random labels
	labelCount := randomInt(2, 6)
	for i := 0; i < labelCount; i++ {
		key := fmt.Sprintf("label-%d", i)
		value := fmt.Sprintf("value-%s", uuid.New().String()[:8])
		resource.Metadata[key] = value
	}

	return resource
}

func runRandomResources(cmd *cobra.Command, args []string) {
	var count int
	if _, err := fmt.Sscanf(args[0], "%d", &count); err != nil {
		log.Fatalf("Invalid count: %s", args[0])
	}

	log.Infof("Generating %d random resources for workspace %s", count, workspaceID)

	// Create Kafka producer
	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": bootstrapServer,
	})
	if err != nil {
		log.Fatalf("Failed to create Kafka producer: %v", err)
	}
	defer producer.Close()

	topic := "workspace-events"
	deliveryChan := make(chan kafka.Event, count)
	baseTimestamp := time.Now().Add(-time.Hour).Unix() * 1000

	// Generate and publish events
	for i := 0; i < count; i++ {
		resource := generateRandomResource(workspaceID, i)

		resourceJSON, err := json.Marshal(resource)
		if err != nil {
			log.Fatalf("Failed to marshal resource: %v", err)
		}

		event := Event{
			EventType:   "resource.created",
			WorkspaceID: workspaceID,
			Data:        resourceJSON,
			Timestamp:   baseTimestamp + int64(i*100), // Increment by 100ms for each event
		}

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

		if (i+1)%100 == 0 {
			log.Infof("Generated %d/%d resources...", i+1, count)
		}
	}

	// Wait for all messages to be delivered
	successCount := 0
	failCount := 0
	for i := 0; i < count; i++ {
		e := <-deliveryChan
		m := e.(*kafka.Message)
		if m.TopicPartition.Error != nil {
			log.Errorf("Failed to deliver message: %v", m.TopicPartition.Error)
			failCount++
		} else {
			successCount++
		}
	}

	log.Infof("Successfully seeded workspace [%s] with %d/%d random resources (%d failed)",
		workspaceID, successCount, count, failCount)
}
