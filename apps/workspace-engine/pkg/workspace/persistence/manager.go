package persistence

import (
	"workspace-engine/pkg/messaging"
)

type Manager struct {
	consumer messaging.Consumer
}

func NewManager(consumer messaging.Consumer) *Manager {
	return &Manager{consumer: consumer}
}
