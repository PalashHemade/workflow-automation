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

# 1b. Load application secrets (GitHub OAuth, Supabase, etc.) for first-time
# deploys. Never rsynced to the server — see ansible/deploy.yml Task 7e.
if [ -f "deploy.env" ]; then
    echo "[+] Sourcing application secrets from deploy.env..."
    source deploy.env
else
    echo "[!] WARNING: deploy.env not found (cp deploy.env.example deploy.env and fill it in)."
    echo "[!] A fresh EC2 instance will come up with placeholder secrets from .env.example —"
    echo "[!] GitHub login and Supabase sync will not work until you fix that manually."
fi

echo "[+] Verifying AWS authentication..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "[-] ERROR: AWS authentication failed. Please configure 'aws configure' or set credentials in aws.env"
    exit 1
fi
echo "[✓] AWS credentials verified successfully."

# 2. Check Key Pair file
KEY_PATH="keys/fa1-key.pem"
KEY_NAME="${KEY_NAME:-fa1-key}"
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
if [ ! -f "$KEY_PATH" ]; then
    echo "[!] WARNING: Private key file '$KEY_PATH' not found."
    echo "[!] Terraform will attempt to provision a new key pair if var.use_existing_key=false."
else
    echo "[✓] Found SSH key file: $KEY_PATH"
    chmod 400 "$KEY_PATH" 2>/dev/null || true
fi

# 2b. Verify the matching key pair is actually registered in AWS — but only
# when use_existing_key=true (its default), since that's the mode where
# Terraform assumes a key pair named "$KEY_NAME" already exists in your AWS
# account. Having the .pem file locally is not enough on its own in that mode.
USE_EXISTING_KEY=$(grep -A2 'variable "use_existing_key"' terraform/variables.tf | grep -oE 'true|false' | head -1)
if [ "$USE_EXISTING_KEY" != "false" ]; then
    echo "[+] Verifying AWS key pair '$KEY_NAME' exists in region '$AWS_REGION'..."
    if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$AWS_REGION" > /dev/null 2>&1; then
        echo "[-] ERROR: AWS key pair '$KEY_NAME' was not found in region '$AWS_REGION'."
        echo "    terraform/variables.tf has use_existing_key=true, which requires this exact"
        echo "    key pair to already exist in AWS (separate from the local .pem file)."
        echo ""
        echo "    Fix options:"
        echo "      A) Import your local key's public half into AWS:"
        echo "         aws ec2 import-key-pair --key-name \"$KEY_NAME\" --region \"$AWS_REGION\" \\"
        echo "             --public-key-material fileb://<(ssh-keygen -y -f \"$KEY_PATH\")"
        echo "      B) Or set use_existing_key=false in terraform/variables.tf to let Terraform"
        echo "         generate a brand new key pair for you."
        exit 1
    fi
    echo "[✓] AWS key pair '$KEY_NAME' verified."
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
export EC2_IP
echo "[✓] EC2 Instance Public IP (stable Elastic IP): $EC2_IP"
GITHUB_OAUTH_CALLBACK=$(terraform output -raw github_oauth_callback_url)

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
echo "[+] Ensuring required Ansible collections are installed..."
ansible-galaxy collection install -r ansible/requirements.yml

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
echo ""
echo "[!] ONE-TIME MANUAL STEP: if this is a fresh deploy, or the IP changed,"
echo "    update your GitHub OAuth App's callback URL to exactly:"
echo "        ${GITHUB_OAUTH_CALLBACK}"
echo "    (GitHub Settings -> Developer settings -> OAuth Apps -> your app)"
echo "    This IP is now stable across redeploys (Elastic IP) — you only need"
echo "    to do this once, unless you fully destroy the instance."
echo "======================================================================"
