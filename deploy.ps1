# ==============================================================================
# Workflow Automation DevOps - Windows PowerShell Master Deployment Pipeline
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "      Workflow Automation DevOps - Automated Deployment Pipeline      " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Verify AWS Credentials
Write-Host "[+] Verifying AWS credentials..." -ForegroundColor Yellow
try {
    $callerIdentity = aws sts get-caller-identity 2>&1
    Write-Host "[✓] AWS credentials verified successfully." -ForegroundColor Green
} catch {
    Write-Host "[-] ERROR: AWS authentication failed. Run 'aws configure' or set environment variables." -ForegroundColor Red
    exit 1
}

# 2. Key Pair Verification
$keyPath = "keys\fa1-key.pem"
if (Test-Path $keyPath) {
    Write-Host "[✓] Found SSH key file: $keyPath" -ForegroundColor Green
} else {
    Write-Host "[!] WARNING: Private key '$keyPath' not found. Terraform will handle key provision if var.use_existing_key=false." -ForegroundColor Yellow
}

# 3. Terraform Provisioning
Write-Host "[+] Navigating to terraform/ directory..." -ForegroundColor Yellow
Set-Location terraform

Write-Host "[+] Initializing Terraform..." -ForegroundColor Yellow
terraform init

Write-Host "[+] Validating Terraform configuration..." -ForegroundColor Yellow
terraform validate

Write-Host "[+] Applying Terraform infrastructure..." -ForegroundColor Yellow
terraform apply -auto-approve

# 4. Extract Output & Write Inventory
$ec2Ip = (terraform output -raw ec2_public_ip).Trim()
Write-Host "[✓] EC2 Public IP: $ec2Ip" -ForegroundColor Green

Set-Location ..
$inventoryPath = "ansible\inventory.ini"
$inventoryContent = @"
[web]
$ec2Ip ansible_user=ubuntu ansible_ssh_private_key_file=../keys/fa1-key.pem ansible_ssh_common_args='-o StrictHostKeyChecking=no'
"@

Set-Content -Path $inventoryPath -Value $inventoryContent
Write-Host "[✓] Updated Ansible inventory at $inventoryPath" -ForegroundColor Green

# 5. Countdown timer for SSH readiness
Write-Host "[+] Waiting 30 seconds for EC2 SSH daemon to initialize..." -ForegroundColor Yellow
for ($i = 30; $i -gt 0; $i--) {
    Write-Host -NoNewline "`r    Initializing SSH... ${i}s remaining"
    Start-Sleep -Seconds 1
}
Write-Host "`n[✓] SSH readiness delay completed." -ForegroundColor Green

# 6. Run Ansible Playbook
Set-Location ansible
$env:ANSIBLE_HOST_KEY_CHECKING = "False"

Write-Host "[+] Executing Ansible deployment playbook..." -ForegroundColor Yellow
if (Get-Command "ansible-playbook" -ErrorAction SilentlyContinue) {
    ansible-playbook -i inventory.ini deploy.yml
} elseif (Get-Command "wsl" -ErrorAction SilentlyContinue) {
    Write-Host "[!] Native ansible-playbook not found. Executing via WSL..." -ForegroundColor Yellow
    wsl ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -i inventory.ini deploy.yml
} else {
    Write-Host "[-] WARNING: Neither ansible-playbook nor WSL was detected on this system." -ForegroundColor Red
    Write-Host "[-] Please run Ansible from WSL or Git Bash: cd ansible; ansible-playbook -i inventory.ini deploy.yml" -ForegroundColor Red
}

Set-Location ..

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "    [✓] DEPLOYMENT COMPLETE! LIVE APPLICATION ACCESSIBLE AT:          " -ForegroundColor Green
Write-Host "        http://${ec2Ip}:3000                                          " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
