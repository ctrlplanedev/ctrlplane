package workspace

import "workspace-engine/pkg/workspace/kafka"

type WorkspaceStorageObject struct {
	ID            string
	KafkaProgress kafka.KafkaProgressMap
	StoreData     []byte
}
