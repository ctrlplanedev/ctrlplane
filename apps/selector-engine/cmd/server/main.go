package main

import (
	"fmt"
	"net"
	"net/http"
	_ "net/http/pprof"
	"strings"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/ctrlplanedev/selector-engine/pkg/logger"
	"github.com/ctrlplanedev/selector-engine/pkg/server"
)

func main() {
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

	port := viper.GetInt("port")
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		log.Fatal("Failed to listen", "error", err)
	}

	s := server.NewServer()

	log.Info("gRPC server listening", "port", port)
	if err := s.Serve(lis); err != nil {
		log.Fatal("Failed to serve", "error", err)
	}

}
