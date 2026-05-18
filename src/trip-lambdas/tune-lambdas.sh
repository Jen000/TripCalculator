#!/bin/bash
# tune-lambdas.sh
#
# Bump all functions to 1024MB memory and arm64. CPU scales linearly with
# memory in Lambda, so this also makes the AWS SDK init phase noticeably
# faster — biggest impact on cold-start latency.
#
# Run once. Cheap (~20% cheaper than x86 + same memory).
#
# Usage: ./tune-lambdas.sh

set -e

REGION="us-east-1"
MEMORY_MB=1024
ARCH="arm64"

FUNCTIONS=(
  "trip-put-trip"
  "get-trip"
  "post-trip"
  "delete-trip"
  "trip-get-settings"
  "put-trip-settings"
  "post-trip-member"
  "delete-trip-member"
  "exportTripCSV"
  "get-expenses"
  "post-expense"
  "put-expense"
  "delete-expense"
  "get-payments"
  "post-payment"
  "delete-payment"
  "get-me"
  "put-me"
)

for FN in "${FUNCTIONS[@]}"; do
  echo "🔧 Tuning $FN (memory=$MEMORY_MB MB, arch=$ARCH)..."

  aws lambda update-function-configuration \
    --function-name "$FN" \
    --memory-size "$MEMORY_MB" \
    --region "$REGION" \
    --output text --query 'FunctionName' > /dev/null

  # Wait for memory update to settle before changing arch — Lambda only
  # accepts one in-flight config update per function at a time.
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FN" \
    --architectures "$ARCH" \
    --region "$REGION" \
    --output text --query 'FunctionName' \
    | xargs -I{} echo "   ✅ {}"

  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
done

echo ""
echo "✅ All functions tuned. Note: switching architecture redeploys the"
echo "   function from the existing zip — make sure your code is arm64-safe"
echo "   (pure JS is fine; native modules need an arm64 build)."
