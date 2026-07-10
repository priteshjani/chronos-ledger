variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID to deploy resources into."
}

variable "region" {
  type        = string
  description = "The Google Cloud region for regional resources."
  default     = "us-west4"
}

variable "zone" {
  type        = string
  description = "The Google Cloud zone for zone-specific resources."
  default     = "us-west4-a"
}
