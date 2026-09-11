variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "instance_type" {
  type        = string
  # t2.micro is the traditionally-documented free-tier type, but many AWS
  # accounts (this one included) now enforce free-tier-eligible instance
  # types only, and only t3.micro/t4g.micro qualify — not t2.micro. Verify
  # with: aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true
  default     = "t3.micro"
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
