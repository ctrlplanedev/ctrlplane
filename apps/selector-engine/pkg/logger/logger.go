package logger

import (
	"os"
	"strings"
	"sync"

	"github.com/charmbracelet/log"
)

var (
	instance *log.Logger
	once     sync.Once
)

// Config holds the logger configuration
type Config struct {
	Level string
}

// Initialize sets up the logger singleton with the given configuration
func Initialize(cfg Config) {
	once.Do(func() {
		instance = log.NewWithOptions(os.Stderr, log.Options{ReportTimestamp: true})
		SetLevel(cfg.Level)
	})
}

// SetLevel updates the logger level
func SetLevel(level string) {
	if instance == nil {
		panic("logger not initialized")
	}

	switch strings.ToLower(level) {
	case "debug":
		instance.SetLevel(log.DebugLevel)
	case "info":
		instance.SetLevel(log.InfoLevel)
	case "warn":
		instance.SetLevel(log.WarnLevel)
	case "error":
		instance.SetLevel(log.ErrorLevel)
	default:
		instance.SetLevel(log.InfoLevel)
	}
}

// Get returns the logger instance
func Get() *log.Logger {
	if instance == nil {
		// Default initialization if not explicitly initialized
		Initialize(Config{Level: "info"})
	}
	return instance
}
