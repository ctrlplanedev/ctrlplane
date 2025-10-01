package main

import (
	"fmt"
	"net"
	_ "net/http/pprof"

	"github.com/charmbracelet/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "workspace-engine/pkg/pb"
	"workspace-engine/pkg/server/releasetarget"
)

func main() {
	pflag.String("host", "0.0.0.0", "Host to listen on")
	pflag.Int("port", 50051, "Port to listen on")
	pflag.Parse()

	if err := viper.BindPFlags(pflag.CommandLine); err != nil {
		log.Fatal("Failed to bind flags", "error", err)
	}

	viper.SetEnvPrefix("WORKSPACE_ENGINE")
	viper.AutomaticEnv()

	host := viper.GetString("host")
	port := viper.GetInt("port")
	addr := fmt.Sprintf("%s:%d", host, port)

	log.Info("Starting workspace engine", "address", addr)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal("Failed to listen", "error", err, "address", addr)
	}

	grpcServer := grpc.NewServer()

	pb.RegisterReleaseTargetServiceServer(grpcServer, releasetarget.New())

	reflection.Register(grpcServer)

	log.Info("gRPC server listening", "address", addr)

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatal("Failed to serve", "error", err)
	}
}
