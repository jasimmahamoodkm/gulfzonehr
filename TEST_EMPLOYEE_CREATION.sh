#!/bin/bash

# Test Employee Auto-Creation API
# This script tests the /api/admin/create-employee endpoint

API_URL="http://localhost:3000/api/admin/create-employee"
BEARER_TOKEN="test-token"
COMPANY_ID="your-company-uuid-here"

# Test case 1: Create a new employee
echo "📝 Test Case 1: Create Employee"
echo "=================================="

curl -X POST $API_URL \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.employee@example.com",
    "first_name": "Test",
    "last_name": "Employee",
    "company_id": "'$COMPANY_ID'",
    "phone": "+971501234567",
    "position": "Test Position",
    "department": "Test Department",
    "date_of_joining": "2026-05-11"
  }' \
  -w "\n\nStatus Code: %{http_code}\n"

echo ""
echo ""

# Test case 2: Try to create with missing required fields
echo "📝 Test Case 2: Missing Required Fields"
echo "========================================"

curl -X POST $API_URL \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com"
  }' \
  -w "\n\nStatus Code: %{http_code}\n"

echo ""
echo ""

# Test case 3: Try without Authorization header
echo "📝 Test Case 3: Missing Authorization"
echo "====================================="

curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test3@example.com",
    "first_name": "Test",
    "last_name": "User",
    "company_id": "'$COMPANY_ID'"
  }' \
  -w "\n\nStatus Code: %{http_code}\n"

echo ""
echo "✅ All tests completed!"
