#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "      Workflow Automation DevOps - Cloud Infrastructure Teardown      "
echo "======================================================================"

if [ -f "aws.env" ]; then
    source aws.env
fi

echo "[+] Navigating to terraform/ directory..."
cd terraform

echo "[+] Destroying Terraform managed cloud resources..."
terraform destroy -auto-approve

cd ..

echo "======================================================================"
echo "    [✓] ALL CLOUD RESOURCES SUCCESSFULLY DESTROYED (ZERO COST)        "
echo "======================================================================"
