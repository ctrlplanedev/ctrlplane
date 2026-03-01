terraform {
  required_providers {
    ctrlplane = {
      source  = "ctrlplanedev/ctrlplane"
      version = "1.6.2"
    }
  }
}

provider "ctrlplane" {}

resource "ctrlplane_job_agent" "test" {
  name = "verification-job-agent"

  test_runner {
    delay_seconds = 5
  }
}

resource "ctrlplane_deployment" "test" {
  name              = "verification-deployment"
  resource_selector = "resource.kind.contains('Kubernetes')"

  job_agent {
    id = ctrlplane_job_agent.test.id
  }
}

resource "ctrlplane_environment" "test" {
  name              = "verification-environment"
  description       = "Environment for verification"
  resource_selector = "resource.kind.contains('Kubernetes')"
}

resource "ctrlplane_system" "test" {
  name        = "verification-system"
  description = "System for verification"
}

resource "ctrlplane_deployment_system_link" "test" {
  system_id     = ctrlplane_system.test.id
  deployment_id = ctrlplane_deployment.test.id
}

resource "ctrlplane_environment_system_link" "test" {
  system_id      = ctrlplane_system.test.id
  environment_id = ctrlplane_environment.test.id
}

resource "ctrlplane_policy" "test" {
  name        = "verification-policy"
  description = "Policy for verification"
  selector    = "deployment.name == 'verification-deployment'"

  verification {
    trigger_on = "jobSuccess"

    metric {
      name     = "verification-metric"
      interval = "10s"
      count    = 10

      success {
        threshold = 6
        condition = "result.value < 0.01"
      }

      failure {
        threshold = 4
        condition = "result.value > 0.01"
      }

      datadog {
        api_key = "test"
        app_key = "test"
        queries = { "test" = "true" }
      }
    }
  }
}
