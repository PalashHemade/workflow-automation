data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "tls_private_key" "ec2_key" {
  count     = var.use_existing_key ? 0 : 1
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated_key" {
  count      = var.use_existing_key ? 0 : 1
  key_name   = var.key_name
  public_key = tls_private_key.ec2_key[0].public_key_openssh
}

resource "local_file" "private_key" {
  count           = var.use_existing_key ? 0 : 1
  content         = tls_private_key.ec2_key[0].private_key_pem
  filename        = "${path.module}/../keys/fa1-key.pem"
  file_permission = "0400"
}

resource "aws_security_group" "web_sg" {
  name        = "Workflow-Automation-DevOps-SG"
  description = "Security group for Workflow Automation Web Server"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Next.js Application"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Workflow-Automation-DevOps-SG"
  }
}

resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "Workflow-Automation-DevOps-Server"
  }
}

# Stable public IP — without this, the instance's public IP changes on every
# terraform apply/destroy cycle, which breaks the GitHub OAuth App's callback
# URL (must exactly match) every time you redeploy. An EIP costs nothing while
# it stays attached to a running instance.
resource "aws_eip" "web_eip" {
  instance = aws_instance.web_server.id
  domain   = "vpc"

  tags = {
    Name = "Workflow-Automation-DevOps-EIP"
  }
}
