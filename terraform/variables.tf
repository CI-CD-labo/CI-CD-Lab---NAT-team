variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for all resources."
}

variable "bucket_suffix" {
  type        = string
  description = "Globally unique suffix for the demo S3 bucket."
}

variable "environment" {
  type        = string
  default     = "lab"
  description = "Environment tag applied to resources."
}
