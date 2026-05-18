#!/bin/bash
# bootstrap-trip-memberships.sh
#
# One-time setup for the new TripMemberships denormalization that
# eliminates the table scans in GET /trips.
#
# Steps:
#   1. Create the TripMemberships DynamoDB table.
#   2. Create + attach an IAM policy granting the affected lambdas
#      Query/PutItem/DeleteItem/BatchWriteItem on TripMemberships.
#   3. Backfill existing memberships from TripSettings.members.
#   4. Set TRIP_MEMBERSHIPS_TABLE env var on the four lambdas that need it,
#      flipping them onto the fast path.
#
# Steps are idempotent — re-running is safe.
#
# Prerequisites:
#   - aws cli configured with sufficient permissions (DynamoDB, Lambda, IAM)
#   - jq installed
#   - run from the repo root or anywhere; AWS_REGION must be set or in
#     your default profile.
#
# Usage:
#   ./bootstrap-trip-memberships.sh
#
#   # If your lambdas already have a shared IAM policy that you'd rather
#   # edit by hand (adding a TripMemberships Statement), skip the IAM step:
#   SKIP_IAM=1 ./bootstrap-trip-memberships.sh

set -e

REGION="us-east-1"
TABLE_NAME="TripMemberships"
POLICY_NAME="TripMembershipsAccess"
TRIP_SETTINGS_TABLE="${TRIP_SETTINGS_TABLE:-TripSettings}"

LAMBDAS_TO_UPDATE=(
  "get-trip"
  "post-trip-member"
  "delete-trip-member"
  "delete-trip"
)

echo "──────────────────────────────────────────────────────────────"
echo " 1. Create TripMemberships table"
echo "──────────────────────────────────────────────────────────────"
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" > /dev/null 2>&1; then
  echo "✓ Table $TABLE_NAME already exists, skipping create."
else
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions \
      AttributeName=userSub,AttributeType=S \
      AttributeName=tripId,AttributeType=S \
    --key-schema \
      AttributeName=userSub,KeyType=HASH \
      AttributeName=tripId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --output text --query 'TableDescription.TableName' \
    | xargs -I{} echo "   ✅ Created {}"

  echo "   ⏳ Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
  echo "   ✅ Table active."
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo " 2. Create + attach IAM policy for TripMemberships access"
echo "──────────────────────────────────────────────────────────────"
if [ "${SKIP_IAM:-0}" = "1" ]; then
  echo "↷ SKIP_IAM=1 — skipping. Make sure your lambda role already grants"
  echo "  Query/PutItem/DeleteItem/BatchWriteItem on TripMemberships, or the"
  echo "  fast path will return AccessDenied."
else
  ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
  TABLE_ARN="arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
  POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

  POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "${TABLE_ARN}"
    }
  ]
}
JSON
  )

  if aws iam get-policy --policy-arn "$POLICY_ARN" > /dev/null 2>&1; then
    echo "✓ Policy $POLICY_NAME already exists, skipping create."
  else
    aws iam create-policy \
      --policy-name "$POLICY_NAME" \
      --policy-document "$POLICY_DOC" \
      --description "Allows Lambda functions to read/write the TripMemberships table." \
      --output text --query 'Policy.PolicyName' \
      | xargs -I{} echo "   ✅ Created policy {}"
  fi

  # Attach to each affected lambda's execution role. attach-role-policy is
  # idempotent — re-attaching is a no-op.
  for FN in "${LAMBDAS_TO_UPDATE[@]}"; do
    ROLE_ARN=$(aws lambda get-function-configuration \
      --function-name "$FN" \
      --region "$REGION" \
      --query 'Role' \
      --output text 2>/dev/null || true)

    if [ -z "$ROLE_ARN" ] || [ "$ROLE_ARN" = "None" ]; then
      echo "   ⚠️  Could not resolve role for lambda $FN, skipping."
      continue
    fi

    ROLE_NAME="${ROLE_ARN##*/}"
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "$POLICY_ARN"
    echo "   ✅ Attached $POLICY_NAME to $ROLE_NAME (for $FN)"
  done
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo " 3. Backfill from $TRIP_SETTINGS_TABLE.members"
echo "──────────────────────────────────────────────────────────────"
# Scan TripSettings once, extract (member.userId, tripId) tuples, and
# write each as a TripMemberships row. Idempotent: re-running is a no-op
# because PutItem overwrites with the same key.
TMP_JSON=$(mktemp)
aws dynamodb scan \
  --table-name "$TRIP_SETTINGS_TABLE" \
  --region "$REGION" \
  --output json > "$TMP_JSON"

ROW_COUNT=0
while IFS= read -r row; do
  tripId=$(jq -r '.tripId.S // empty' <<<"$row")
  if [ -z "$tripId" ]; then continue; fi

  # We don't have ownerSub in TripSettings, so we look it up from the
  # Trips table. This is one Query per trip — fine for a one-time backfill.
  ownerSub=$(aws dynamodb scan \
    --table-name trips \
    --filter-expression "tripId = :t" \
    --expression-attribute-values "{\":t\":{\"S\":\"$tripId\"}}" \
    --projection-expression "userSub" \
    --region "$REGION" \
    --output json | jq -r '.Items[0].userSub.S // empty')

  if [ -z "$ownerSub" ]; then
    echo "   ⚠️  No owner found for tripId=$tripId, skipping."
    continue
  fi

  # For each member, write a row.
  members=$(jq -c '.members.L // []' <<<"$row")
  jq -c '.[] | .M | {userId: .userId.S, addedAt: (.addedAt.S // "")}' <<<"$members" | while read -r member; do
    memberSub=$(jq -r '.userId' <<<"$member")
    addedAt=$(jq -r '.addedAt' <<<"$member")
    [ -z "$memberSub" ] && continue

    aws dynamodb put-item \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --item "{
        \"userSub\": {\"S\": \"$memberSub\"},
        \"tripId\": {\"S\": \"$tripId\"},
        \"ownerSub\": {\"S\": \"$ownerSub\"},
        \"addedAt\": {\"S\": \"$addedAt\"}
      }" > /dev/null
    ROW_COUNT=$((ROW_COUNT + 1))
    echo "   + $memberSub -> $tripId (owner $ownerSub)"
  done
done < <(jq -c '.Items[]' "$TMP_JSON")

rm -f "$TMP_JSON"
echo "✅ Backfilled $ROW_COUNT memberships."

echo ""
echo "──────────────────────────────────────────────────────────────"
echo " 4. Set TRIP_MEMBERSHIPS_TABLE env var on lambdas"
echo "──────────────────────────────────────────────────────────────"
# IAM updates can take a few seconds to propagate. Sleep briefly before
# flipping env vars so the first post-flip invocation doesn't hit a stale
# AccessDenied. Cheaper than provisioning a verification roundtrip.
echo "   ⏳ Sleeping 15s for IAM propagation..."
sleep 15

for FN in "${LAMBDAS_TO_UPDATE[@]}"; do
  # Merge with existing env vars so we don't blow away anything else.
  EXISTING=$(aws lambda get-function-configuration \
    --function-name "$FN" \
    --region "$REGION" \
    --query 'Environment.Variables' \
    --output json)

  MERGED=$(echo "$EXISTING" | jq --arg name "$TABLE_NAME" '. + { TRIP_MEMBERSHIPS_TABLE: $name }')

  aws lambda update-function-configuration \
    --function-name "$FN" \
    --environment "{\"Variables\": $MERGED}" \
    --region "$REGION" \
    --output text --query 'FunctionName' \
    | xargs -I{} echo "   ✅ {}"
done

echo ""
echo "✅ All done. GET /trips should now use the fast path."
echo ""
echo "To roll back: detach $POLICY_NAME from the lambda roles and unset"
echo "TRIP_MEMBERSHIPS_TABLE env var. The lambdas fall back to the legacy"
echo "scan-based path automatically when the env var is missing."
