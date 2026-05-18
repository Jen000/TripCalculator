#!/bin/bash
# bootstrap-trip-memberships.sh
#
# One-time setup for the new TripMemberships denormalization that
# eliminates the table scans in GET /trips.
#
# Steps:
#   1. Create the TripMemberships DynamoDB table.
#   2. Backfill existing memberships from TripSettings.members.
#   3. Set TRIP_MEMBERSHIPS_TABLE env var on the three lambdas that need it,
#      flipping them onto the fast path.
#
# Prerequisites:
#   - aws cli configured with sufficient permissions
#   - jq installed
#   - run from the repo root or anywhere; AWS_REGION must be set or in
#     your default profile.
#
# Usage: ./bootstrap-trip-memberships.sh

set -e

REGION="us-east-1"
TABLE_NAME="TripMemberships"
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
echo " 2. Backfill from $TRIP_SETTINGS_TABLE.members"
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
    --table-name Trips \
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
echo " 3. Set TRIP_MEMBERSHIPS_TABLE env var on lambdas"
echo "──────────────────────────────────────────────────────────────"
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
