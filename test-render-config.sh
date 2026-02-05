#!/bin/bash

# Test script to verify Render environment configuration

echo "🔍 Testing Olubanise Orchestrator Configuration..."
echo ""

ORCHESTRATOR_URL="https://olubanise-orchestrator.onrender.com"

echo "1️⃣ Testing health endpoint..."
curl -s "$ORCHESTRATOR_URL/api/sessions/health" | jq '.'
echo ""

echo "2️⃣ Testing debug/config endpoint..."
curl -s "$ORCHESTRATOR_URL/api/sessions/debug/config" | jq '.'
echo ""

echo "3️⃣ Testing authentication with correct secret..."
curl -s -X POST "$ORCHESTRATOR_URL/api/sessions/00000000-0000-0000-0000-000000000000/status" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: OlubaniseInternalSecureKey_2026" \
  -d '{"status":"connecting"}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

echo "✅ Test complete!"
echo ""
echo "Expected results:"
echo "  - Health: {\"status\":\"healthy\"}"
echo "  - Config: {\"hasWorkerSecret\":true,\"secretLength\":31,\"secretPreview\":\"O...6\"}"
echo "  - Auth test: HTTP Status: 200"
echo ""
echo "If you see 401 Unauthorized, the Worker__SharedSecret is NOT set on Render!"
