# ==============================================================================
# Workflow Automation DevOps - Windows PowerShell Infrastructure Teardown
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Red
Write-Host "      Workflow Automation DevOps - Cloud Infrastructure Teardown      " -ForegroundColor Red
Write-Host "======================================================================" -ForegroundColor Red

Write-Host "[+] Navigating to terraform/ directory..." -ForegroundColor Yellow
Set-Location terraform

Write-Host "[+] Destroying Terraform managed cloud resources..." -ForegroundColor Yellow
terraform destroy -auto-approve

Set-Location ..

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "    [✓] ALL CLOUD RESOURCES SUCCESSFULLY DESTROYED (ZERO COST)        " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
