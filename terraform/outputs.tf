output "ec2_public_ip" {
  description = "Public IPv4 address of the EC2 instance"
  value       = aws_instance.web_server.public_ip
}

output "ssh_connection_command" {
  description = "SSH connection command for the instance"
  value       = "ssh -i ../keys/fa1-key.pem ubuntu@${aws_instance.web_server.public_ip}"
}
