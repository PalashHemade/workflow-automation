output "ec2_public_ip" {
  description = "Stable public IPv4 address of the EC2 instance (Elastic IP)"
  value       = aws_eip.web_eip.public_ip
}

output "ssh_connection_command" {
  description = "SSH connection command for the instance"
  value       = "ssh -i ../keys/fa1-key.pem ubuntu@${aws_eip.web_eip.public_ip}"
}

output "github_oauth_callback_url" {
  description = "Register this exact URL as the GitHub OAuth App's callback URL"
  value       = "http://${aws_eip.web_eip.public_ip}:3000/api/auth/callback/github"
}
