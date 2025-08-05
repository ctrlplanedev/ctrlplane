package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"workspace-engine/pkg/kafka"
	"workspace-engine/pkg/logger"
)

func main() {
	ctx := context.Background()
	pflag.Int("port", 50555, "The server port")
	pflag.String("log-level", "info", "Log level (debug, info, warn, error)")
	pflag.Parse()

	if err := viper.BindPFlags(pflag.CommandLine); err != nil {
		panic("Failed to bind flags: " + err.Error())
	}
	viper.SetEnvPrefix("SELECTOR_ENGINE")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	// Initialize logger singleton
	logger.Initialize(logger.Config{
		Level: viper.GetString("log-level"),
	})
	log := logger.Get()

	go func() {
		log.Info("Starting pprof server on :6060")
		if err := http.ListenAndServe(":6060", nil); err != nil {
			log.Error("Failed to start pprof server", "error", err)
		}
	}()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	go func() {
		if err := kafka.RunConsumer(ctx); err != nil {
			log.Error("received error from kafka consumer", "error", err)
		}
	}()

	port := viper.GetInt("port")
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		log.Fatal("Failed to listen", "error", err)
	}
	defer lis.Close()

	log.Info("Workspace engine started", "port", port)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info("Shutting down workspace engine...")
	cancel()
}
