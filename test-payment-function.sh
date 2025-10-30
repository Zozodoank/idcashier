#!/bin/bash
# Test script for the duitku-payment-request function

# Replace with your actual Supabase project URL
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/duitku-payment-request"

# Test 1: Request without Authorization header (should return 401)
echo "Test 1: Request without Authorization header"
curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentAmount": 50000,
    "productDetails": "Test Product",
    "merchantOrderId": "TEST-'$(date +%s)'"
  }'

echo -e "\n\nExpected: 401 Unauthorized"

# Test 2: Request with invalid Authorization header (should return 401)
echo -e "\n\nTest 2: Request with invalid Authorization header"
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentAmount": 50000,
    "productDetails": "Test Product",
    "merchantOrderId": "TEST-'$(date +%s)'"
  }'

echo -e "\n\nExpected: 401 Unauthorized"

# Instructions for Test 3: Valid request with real token
echo -e "\n\nTest 3: Valid request with real token"
echo "To test with a valid token, first authenticate with Supabase and get your access token."
echo "Then run:"
echo "curl -X POST \"$FUNCTION_URL\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"paymentAmount\": 50000,"
echo "    \"productDetails\": \"Test Product\","
echo "    \"merchantOrderId\": \"TEST-'$(date +%s)'\""
echo "  }'"
echo -e "\nExpected: 200 OK with payment record created"