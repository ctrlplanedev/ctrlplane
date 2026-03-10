terraform {
  required_providers {
    ctrlplane = {
      source  = "ctrlplanedev/ctrlplane"
      version = "1.6.2"
    }
  }
}

provider "ctrlplane" {}

resource "ctrlplane_relationship_rule" "this" {
  name      = "this"
  reference = "this"
  matcher   = <<CEL
    from.kind == "GoogleNetwork" && to.kind == "GoogleKubernetesEngine" &&
    from.metadata['google/project'] == to.metadata['google/project'] &&
    from.metadata['network/name'] == to.metadata['network/name']
  CEL
}