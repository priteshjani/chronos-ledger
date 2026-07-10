output "project_id" {
  value       = var.project_id
  description = "The Google Cloud Project ID."
}

output "artifact_registry_repository" {
  value       = google_artifact_registry_repository.chronos_repo.name
  description = "Artifact Registry Docker Repository name."
}

output "spanner_instance" {
  value       = google_spanner_instance.spanner_inst.name
  description = "Spanner Instance name."
}

output "spanner_database" {
  value       = google_spanner_database.chronos_spanner_db.name
  description = "Spanner Database name."
}
