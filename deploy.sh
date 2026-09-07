#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "      Workflow Automation DevOps - Automated Deployment Pipeline      "
echo "======================================================================"

# 1. Check & Load AWS Credentials
if [ -f "aws.env" ]; then
    echo "[+] Sourcing environment variables from aws.env..."
    source aws.env
fi

echo "[+] Verifying AWS authentication..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "[-] ERROR: AWS authentication failed. Please configure 'aws configure' or set credentials in aws.env"
    exit 1
fi
echo "[✓] AWS credentials verified successfully."

# 2. Check Key Pair file
KEY_PATH="keys/fa1-key.pem"
if [ ! -f "$KEY_PATH" ]; then
    echo "[!] WARNING: Private key file '$KEY_PATH' not found."
    echo "[!] Terraform will attempt to provision a new key pair if var.use_existing_key=false."
else
    echo "[✓] Found SSH key file: $KEY_PATH"
    chmod 400 "$KEY_PATH" 2>/dev/null || true
fi

# 3. Provision Infrastructure with Terraform
echo "[+] Navigating to terraform/ directory..."
cd terraform

echo "[+] Initializing Terraform..."
terraform init

echo "[+] Validating Terraform configuration..."
terraform validate

echo "[+] Applying Terraform infrastructure..."
terraform apply -auto-approve

# 4. Extract Public IP and Generate Inventory
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "[✓] EC2 Instance Public IP: $EC2_IP"

echo "[+] Generating Ansible inventory file at ../ansible/inventory.ini..."
cat <<EOF > ../ansible/inventory.ini
[web]
$EC2_IP ansible_user=ubuntu ansible_ssh_private_key_file=../keys/fa1-key.pem ansible_ssh_common_args='-o StrictHostKeyChecking=no'
EOF

# 5. Countdown for EC2 SSH Readiness
cd ..
echo "[+] Waiting 30 seconds for EC2 SSH daemon initialization..."
for i in {30..1}; do
    echo -ne "    Initializing SSH... ${i}s remaining\r"
    sleep 1
done
echo -e "\n[✓] SSH readiness delay completed."

# 6. Configuration Management with Ansible
cd ansible
echo "[+] Testing Ansible connection (ping)..."
export ANSIBLE_HOST_KEY_CHECKING=False
ansible all -i inventory.ini -m ping

echo "[+] Running Ansible deployment playbook..."
ansible-playbook -i inventory.ini deploy.yml

cd ..

echo "======================================================================"
echo "    [✓] DEPLOYMENT COMPLETE! LIVE APPLICATION ACCESSIBLE AT:          "
echo "        http://${EC2_IP}:3000                                          "
echo "======================================================================"
