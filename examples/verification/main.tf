terraform {
  required_providers {
    ctrlplane = {
      source  = "ctrlplanedev/ctrlplane"
      version = "1.6.2"
    }
  }
}

provider "ctrlplane" {}

# resource "ctrlplane_job_agent" "test" {
#   name = "verification-job-agent"

#   test_runner {
#     delay_seconds = 5
#   }
# }

resource "ctrlplane_deployment" "test" {
  name              = "verification-deployment"
  resource_selector = "resource.kind.contains('Kubernetes')"

  # job_agent {
  #   id = ctrlplane_job_agent.test.id
  # }
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

resource "ctrlplane_policy" "test2" {
  name     = "test2"
  selector = "deployment.name.contains('') && true"

  any_approval {
    min_approvals = 1
  }

  gradual_rollout {
    rollout_type        = "linear"
    time_scale_interval = 300
  }
  
  version_cooldown {
    duration = "10m"
  }
}

resource "ctrlplane_policy" "prod" {
  name     = "prod-dev"
  selector = "deployment.name.contains('prod')"

  environment_progression {
    depends_on_environment_selector = "environment.name == 'dev'"
    maximum_age_hours = 1
    minimum_success_percentage = 1
  }
}

resource "ctrlplane_environment" "dev" {
  name              = "dev"
  description       = "Development environment"
  resource_selector = "resource.kind.contains('KubernetesCluster')"
}

resource "ctrlplane_environment" "prod" {
  name              = "prod"
  description       = "Production environment"
  resource_selector = "resource.kind.contains('Kubernetes')"
}

resource "ctrlplane_deployment" "dev" {
  name              = "Dev Deployment"
  resource_selector = "resource.kind.contains('Kubernetes')"
}

resource "ctrlplane_deployment" "prod" {
  name              = "Prod Deployment"
  resource_selector = "resource.kind.contains('Kubernetes')"
}

resource "ctrlplane_deployment_system_link" "dev" {
  system_id     = ctrlplane_system.test.id
  deployment_id = ctrlplane_deployment.dev.id
}

resource "ctrlplane_environment_system_link" "dev" {
  system_id      = ctrlplane_system.test.id
  environment_id = ctrlplane_environment.dev.id
}

resource "ctrlplane_deployment_system_link" "prod" {
  system_id     = ctrlplane_system.test.id
  deployment_id = ctrlplane_deployment.prod.id
}

resource "ctrlplane_environment_system_link" "prod" {
  system_id      = ctrlplane_system.test.id
  environment_id = ctrlplane_environment.prod.id
}