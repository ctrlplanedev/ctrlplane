package main

import (
	"fmt"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/ctrlplanedev/selector-engine/pkg/server"
)

func main() {
	// Setup flags
	pflag.Int("port", 50555, "The server port")
	pflag.String("log-level", "info", "Log level (debug, info, warn, error)")
	pflag.Parse()

	// Setup viper
	viper.BindPFlags(pflag.CommandLine)
	viper.SetEnvPrefix("SELECTOR_ENGINE")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	// Setup logger
	logLevel := viper.GetString("log-level")
	logger := log.NewWithOptions(os.Stderr, log.Options{ReportTimestamp: true})
	switch strings.ToLower(logLevel) {
	case "debug":
		logger.SetLevel(log.DebugLevel)
	case "info":
		logger.SetLevel(log.InfoLevel)
	case "warn":
		logger.SetLevel(log.WarnLevel)
	case "error":
		logger.SetLevel(log.ErrorLevel)
	default:
		logger.SetLevel(log.InfoLevel)
	}

	go func() {
		logger.Info("Starting pprof server on :6060")
		if err := http.ListenAndServe(":6060", nil); err != nil {
			logger.Error("Failed to start pprof server", "error", err)
		}
	}()

	port := viper.GetInt("port")
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		logger.Fatal("Failed to listen", "error", err)
	}

	s := server.NewServer()

	logger.Info("gRPC server listening", "port", port)
	if err := s.Serve(lis); err != nil {
		logger.Fatal("Failed to serve", "error", err)
	}

}
