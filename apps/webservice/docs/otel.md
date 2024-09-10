# OpenTelemetry (OTEL)

## :whale: Local Development with OpenTelemetry (OTEL)

To enhance your local development experience and capture traces, metrics, and logs, you can use OpenTelemetry with Docker Compose. Follow the steps below to set up OpenTelemetry for your project:

1. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/sizzldev/ctrlplane.git
cd ctrlplane
```

2. Run the following command to start the necessary services (Jaeger, Zipkin, Prometheus, OTEL Collector):

```bash
pnpm otel:up
```

3. The services will start in detached mode, including:

   - **Jaeger** for distributed tracing at `http://localhost:16686`
   - **Zipkin** at `http://localhost:9411`
   - **Prometheus** for metrics scraping at `http://localhost:9090`
   - **OpenTelemetry Collector** with exposed endpoints for OTLP metrics and traces

4. To view the real-time telemetry data, access Jaeger or Zipkin through their respective URLs. You can also monitor system metrics via Prometheus.

5. You can now run the application with telemetry enabled and start tracking your service's performance.

```bash
pnpm dev:otel
```

To stop the services, use:

```bash
pnpm otel:down
```

Ensure your OTEL environment variables are set correctly for proper trace and metric collection in your services.

Feel free to customize the `docker-compose.otel.yaml` file to suit your needs or extend it to fit your local development workflow.
