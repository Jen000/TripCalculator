#!/bin/bash
# deploy.sh — zips and deploys all Lambda functions
# Usage: ./deploy.sh
# Prerequisites: aws cli configured, correct AWS_PROFILE / region set

set -e  # exit on any error

REGION="us-east-1" 

# Map of function-name -> handler-file
# Left side = your Lambda function name in AWS
# Right side = path to the handler file
declare -A FUNCTIONS=(
  ["trip-put-trip"]="trips/putTrip.js"
  ["get-trip"]="trips/getTrip.js"
  ["post-trip"]="trips/postTrip.js"
  ["delete-trip"]="trips/deleteTrip.js"
  ["trip-get-settings"]="trips/getTripSettings.js"
  ["put-trip-settings"]="trips/putTripSettings.js"
  ["post-trip-member"]="trips/postTripMember.js"
  ["delete-trip-member"]="trips/deleteTripMember.js"
  ["exportTripCSV"]="trips/exportTripCsv.js"
  ["get-expenses"]="expenses/getExpenses.js"
  ["post-expense"]="expenses/postExpense.js"
  ["put-expense"]="expenses/putExpense.js"
  ["delete-expense"]="expenses/deleteExpense.js"
  ["get-payments"]="payments/getPayments.js"
  ["post-payment"]="payments/postPayment.js"
  ["delete-payment"]="payments/deletePayment.js"
)

TMP_DIR=$(mktemp -d)

for FUNCTION_NAME in "${!FUNCTIONS[@]}"; do
  HANDLER_FILE="${FUNCTIONS[$FUNCTION_NAME]}"
  ZIP_PATH="$TMP_DIR/$FUNCTION_NAME.zip"

  echo "📦 Packaging $FUNCTION_NAME ($HANDLER_FILE)..."

  # Each zip contains the handler + the shared/ folder
  zip -j "$ZIP_PATH" "$HANDLER_FILE" shared/db.js shared/response.js shared/auth.js > /dev/null

  echo "🚀 Deploying $FUNCTION_NAME..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_PATH" \
    --region "$REGION" \
    --output text --query 'FunctionName' \
    | xargs -I{} echo "   ✅ {}"
done

rm -rf "$TMP_DIR"
echo ""
echo "✅ All functions deployed!"