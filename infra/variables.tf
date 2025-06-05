variable "region" {
  description = "The AWS region where resources will be deployed"
  type        = string
  default     = "eu-north-1"
}

variable "environment" {
  description = "The environment where the resources will be deployed"
  type        = string
  default     = "dev"
}

variable "webhook_url" {
  description = "The webhook URL for the API events endpoint"
  type        = string
  default     = "https://conformance.services.dev.carbon-transparency.org"
}
