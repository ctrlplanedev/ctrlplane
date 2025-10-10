package server

// Example integration for main.go:
//
// Replace the existing Connect RPC setup with Gin:
//
// func main() {
// 	// ... existing setup code ...
//
// 	// Create Gin server
// 	ginServer := server.New()
// 	router := ginServer.SetupRouter()
//
// 	// Create HTTP server
// 	httpServer := &http.Server{
// 		Addr:    addr,
// 		Handler: router,
// 	}
//
// 	// ... rest of the existing code (kafka consumer, signal handling, etc.) ...
//
// 	go func() {
// 		log.Info("HTTP server started", "address", addr)
// 		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
// 			log.Fatal("Failed to serve", "error", err)
// 		}
// 	}()
//
// 	// ... signal handling and shutdown ...
// }

