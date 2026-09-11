# ==============================================================================
# Workflow Automation DevOps - Windows PowerShell Master Deployment Pipeline
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "      Workflow Automation DevOps - Automated Deployment Pipeline      " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Loads simple `export KEY="VALUE"` lines (bash-style, shared with deploy.sh)
# into this process's environment variables.
function Import-EnvFile {
    param([string]$Path)
    if (Test-Path $Path) {
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^\s*export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$') {
                [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
        }
    }
}

# 0. Load application secrets (GitHub OAuth, Supabase, etc.) for first-time
# deploys. Never rsynced to the server — see ansible/deploy.yml Task 7e.
if (Test-Path "deploy.env") {
    Write-Host "[+] Sourcing application secrets from deploy.env..." -ForegroundColor Yellow
    Import-EnvFile "deploy.env"
} else {
    Write-Host "[!] WARNING: deploy.env not found (copy deploy.env.example to deploy.env and fill it in)." -ForegroundColor Yellow
    Write-Host "[!] A fresh EC2 instance will come up with placeholder secrets from .env.example." -ForegroundColor Yellow
}

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

# 2b. Verify the matching key pair is actually registered in AWS — but only
# when use_existing_key=true (its default), since that's the mode where
# Terraform assumes a key pair named "$keyName" already exists in your AWS
# account. Having the .pem file locally is not enough on its own in that mode.
$keyName = if ($env:KEY_NAME) { $env:KEY_NAME } else { "fa1-key" }
$awsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "us-east-1" }
$useExistingKeyBlock = Select-String -Path "terraform\variables.tf" -Pattern 'variable "use_existing_key"' -Context 0,2
$useExistingKey = -not ($useExistingKeyBlock -and ($useExistingKeyBlock.Context.PostContext -join "`n") -match 'default\s*=\s*false')
if ($useExistingKey) {
    Write-Host "[+] Verifying AWS key pair '$keyName' exists in region '$awsRegion'..." -ForegroundColor Yellow
    aws ec2 describe-key-pairs --key-names $keyName --region $awsRegion *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] ERROR: AWS key pair '$keyName' was not found in region '$awsRegion'." -ForegroundColor Red
        Write-Host "    terraform\variables.tf has use_existing_key=true, which requires this exact" -ForegroundColor Red
        Write-Host "    key pair to already exist in AWS (separate from the local .pem file)." -ForegroundColor Red
        Write-Host ""
        Write-Host "    Fix options:" -ForegroundColor Yellow
        Write-Host "      A) Import your local key's public half into AWS (requires OpenSSH's ssh-keygen):" -ForegroundColor Yellow
        Write-Host "         ssh-keygen -y -f `"$keyPath`" > pubkey.tmp" -ForegroundColor Yellow
        Write-Host "         aws ec2 import-key-pair --key-name `"$keyName`" --region `"$awsRegion`" --public-key-material fileb://pubkey.tmp" -ForegroundColor Yellow
        Write-Host "      B) Or set use_existing_key=false in terraform\variables.tf to let Terraform" -ForegroundColor Yellow
        Write-Host "         generate a brand new key pair for you." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[✓] AWS key pair '$keyName' verified." -ForegroundColor Green
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
$env:EC2_IP = $ec2Ip
Write-Host "[✓] EC2 Public IP (stable Elastic IP): $ec2Ip" -ForegroundColor Green
$githubOauthCallback = (terraform output -raw github_oauth_callback_url).Trim()

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
Write-Host "[+] Ensuring required Ansible collections are installed..." -ForegroundColor Yellow
if (Get-Command "ansible-galaxy" -ErrorAction SilentlyContinue) {
    ansible-galaxy collection install -r ansible/requirements.yml
} elseif (Get-Command "wsl" -ErrorAction SilentlyContinue) {
    wsl ansible-galaxy collection install -r ansible/requirements.yml
}

Set-Location ansible
$env:ANSIBLE_HOST_KEY_CHECKING = "False"

Write-Host "[+] Executing Ansible deployment playbook..." -ForegroundColor Yellow
if (Get-Command "ansible-playbook" -ErrorAction SilentlyContinue) {
    ansible-playbook -i inventory.ini deploy.yml
} elseif (Get-Command "wsl" -ErrorAction SilentlyContinue) {
    Write-Host "[!] Native ansible-playbook not found. Executing via WSL..." -ForegroundColor Yellow
    # WSL does not inherit Windows environment variables by default — without
    # this, EC2_IP and every secret loaded from deploy.env would silently
    # come through as empty inside the playbook (Task 7e/7f would just skip
    # setting them, no error), leaving the box with placeholder secrets.
    $env:WSLENV = "EC2_IP:GITHUB_CLIENT_ID:GITHUB_CLIENT_SECRET:GITHUB_WEBHOOK_SECRET:DATABASE_URL:DIRECT_URL:GROQ_API_KEY:JIRA_CLIENT_ID:JIRA_CLIENT_SECRET"
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
Write-Host ""
Write-Host "[!] ONE-TIME MANUAL STEP: if this is a fresh deploy, or the IP changed," -ForegroundColor Yellow
Write-Host "    update your GitHub OAuth App's callback URL to exactly:" -ForegroundColor Yellow
Write-Host "        $githubOauthCallback" -ForegroundColor Yellow
Write-Host "    (GitHub Settings -> Developer settings -> OAuth Apps -> your app)" -ForegroundColor Yellow
Write-Host "    This IP is now stable across redeploys (Elastic IP) — you only need" -ForegroundColor Yellow
Write-Host "    to do this once, unless you fully destroy the instance." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
