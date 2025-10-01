package main

import (
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"workspace-engine/pkg/grpc/releasetarget"
	"workspace-engine/pkg/pb/pbconnect"

	"github.com/charmbracelet/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	pflag.String("host", "0.0.0.0", "Host to listen on")
	pflag.Int("port", 8081, "Port to listen on")
	pflag.Parse()

	if err := viper.BindPFlags(pflag.CommandLine); err != nil {
		log.Fatal("Failed to bind flags", "error", err)
	}

	viper.SetEnvPrefix("WORKSPACE_ENGINE")
	viper.AutomaticEnv()

	host := viper.GetString("host")
	port := viper.GetInt("port")
	addr := fmt.Sprintf("%s:%d", host, port)

	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Register the Connect service
	path, handler := pbconnect.NewReleaseTargetServiceHandler(releasetarget.New())
	mux.Handle(path, handler)

	// Create an HTTP/2 server with h2c (HTTP/2 cleartext) support
	// This allows both gRPC and Connect protocols to work
	server := &http.Server{
		Addr:    addr,
		Handler: h2c.NewHandler(mux, &http2.Server{}),
	}

	log.Info("Connect server listening", "address", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal("Failed to serve", "error", err)
	}
}
