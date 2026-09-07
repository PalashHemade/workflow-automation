variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "instance_type" {
  type        = string
  default     = "t2.micro"
  description = "EC2 instance size"
}

variable "key_name" {
  type        = string
  default     = "fa1-key"
  description = "Name of the EC2 key pair"
}

variable "use_existing_key" {
  type        = bool
  default     = true
  description = "Set true to use pre-existing key pair on AWS; false to auto-generate"
}
