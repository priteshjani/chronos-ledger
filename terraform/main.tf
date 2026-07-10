terraform {
  required_version = ">= 1.3.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# 1. Enable Required Google Cloud APIs
locals {
  apis = [
    "spanner.googleapis.com",          # Cloud Spanner API
    "artifactregistry.googleapis.com", # Artifact Registry API
    "run.googleapis.com"               # Cloud Run API (for container deployment)
  ]
}

resource "google_project_service" "services" {
  for_each           = toset(local.apis)
  service            = each.key
  disable_on_destroy = false
}

# 2. Artifact Registry for Container Image (Optional for Cloud Run Deployment)
resource "google_artifact_registry_repository" "chronos_repo" {
  depends_on    = [google_project_service.services]
  location      = var.region
  repository_id = "chronos-ledger-repo"
  description   = "Docker registry for ChronosLedger container"
  format        = "DOCKER"
}

# 3. Cloud Spanner Instance
resource "google_spanner_instance" "spanner_inst" {
  depends_on   = [google_project_service.services]
  config       = "regional-${var.region}"
  display_name = "Spanner Demo Instance"
  name         = "spanner-demo-inst"
  num_nodes    = 1
}

# 4. ChronosLedger Spanner Database & Schema DDL
resource "google_spanner_database" "chronos_spanner_db" {
  instance = google_spanner_instance.spanner_inst.name
  name     = "chronos-ledger-db"
  
  # Schema definition matches backend setup_spanner.py script
  ddl = [
    "CREATE TABLE players (player_id INT64 NOT NULL, name STRING(100) NOT NULL, balance INT64 NOT NULL) PRIMARY KEY(player_id)",
    "CREATE TABLE items (item_id INT64 NOT NULL, name STRING(100) NOT NULL, price INT64 NOT NULL, stock INT64 NOT NULL) PRIMARY KEY(item_id)",
    "CREATE TABLE entitlements (entitlement_id STRING(100) NOT NULL, player_id INT64 NOT NULL, item_id INT64 NOT NULL, granted_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true)) PRIMARY KEY(entitlement_id)",
    "CREATE TABLE ledger (transaction_id STRING(100) NOT NULL, player_id INT64 NOT NULL, item_id INT64 NOT NULL, amount INT64 NOT NULL, timestamp TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true), status STRING(20) NOT NULL) PRIMARY KEY(transaction_id)"
  ]
  deletion_protection = false
}
