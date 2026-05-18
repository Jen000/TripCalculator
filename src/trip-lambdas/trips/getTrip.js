import { QueryCommand, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TRIPS_TABLE = process.env.TRIPS_TABLE;
const TRIP_SETTINGS_TABLE = process.env.TRIP_SETTINGS_TABLE;
const TRIP_MEMBERSHIPS_TABLE = process.env.TRIP_MEMBERSHIPS_TABLE;

// Fast path: Query owned trips + Query memberships in parallel, then BatchGet
// the shared trip rows by their (ownerSub, tripId) keys. No table scans.
async function loadOwnedAndSharedFast(userSub) {
  const [ownedResult, membershipsResult] = await Promise.all([
    ddb.send(new QueryCommand({
      TableName: TRIPS_TABLE,
      KeyConditionExpression: "userSub = :u",
      ExpressionAttributeValues: { ":u": userSub },
    })),
    ddb.send(new QueryCommand({
      TableName: TRIP_MEMBERSHIPS_TABLE,
      KeyConditionExpression: "userSub = :u",
      ExpressionAttributeValues: { ":u": userSub },
    })),
  ]);

  const ownedTrips = ownedResult.Items ?? [];
  const ownedTripIds = new Set(ownedTrips.map((t) => t.tripId));

  const sharedKeys = (membershipsResult.Items ?? [])
    .filter((m) => m.ownerSub && m.tripId && !ownedTripIds.has(m.tripId))
    .map((m) => ({ userSub: m.ownerSub, tripId: m.tripId }));

  const sharedTrips = [];
  for (let i = 0; i < sharedKeys.length; i += 100) {
    const chunk = sharedKeys.slice(i, i + 100);
    let request = { RequestItems: { [TRIPS_TABLE]: { Keys: chunk } } };
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await ddb.send(new BatchGetCommand(request));
      sharedTrips.push(...(res.Responses?.[TRIPS_TABLE] ?? []));
      const unprocessed = res.UnprocessedKeys?.[TRIPS_TABLE]?.Keys ?? [];
      if (!unprocessed.length) break;
      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
      request = { RequestItems: { [TRIPS_TABLE]: { Keys: unprocessed } } };
    }
  }
  return { ownedTrips, sharedTrips };
}

// Legacy path: kept so the lambda keeps working until the TripMemberships
// table is created and TRIP_MEMBERSHIPS_TABLE env var is set on the lambda.
// Scans the TripSettings table; do NOT rely on this in production.
async function loadOwnedAndSharedLegacy(userSub) {
  const ownedResult = await ddb.send(new QueryCommand({
    TableName: TRIPS_TABLE,
    KeyConditionExpression: "userSub = :u",
    ExpressionAttributeValues: { ":u": userSub },
  }));
  const ownedTrips = ownedResult.Items ?? [];
  const ownedTripIds = new Set(ownedTrips.map((t) => t.tripId));

  let sharedTrips = [];
  if (TRIP_SETTINGS_TABLE) {
    try {
      const settingsResult = await ddb.send(new ScanCommand({
        TableName: TRIP_SETTINGS_TABLE,
      }));

      const sharedTripIds = (settingsResult.Items ?? [])
        .filter((item) => {
          const members = item.members ?? [];
          return (
            members.some((m) => m.userId === userSub) &&
            !ownedTripIds.has(item.tripId)
          );
        })
        .map((item) => item.tripId);

      if (sharedTripIds.length > 0) {
        const scanResult = await ddb.send(new ScanCommand({
          TableName: TRIPS_TABLE,
          FilterExpression: sharedTripIds
            .map((_, i) => `tripId = :tid${i}`)
            .join(" OR "),
          ExpressionAttributeValues: Object.fromEntries(
            sharedTripIds.map((id, i) => [`:tid${i}`, id])
          ),
        }));
        sharedTrips = scanResult.Items ?? [];
      }
    } catch (err) {
      console.warn("Could not fetch shared trips (legacy path):", err.message);
    }
  }

  return { ownedTrips, sharedTrips };
}

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const { ownedTrips, sharedTrips } = TRIP_MEMBERSHIPS_TABLE
      ? await loadOwnedAndSharedFast(userSub)
      : await loadOwnedAndSharedLegacy(userSub);

    const allTrips = [...ownedTrips, ...sharedTrips];
    allTrips.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return response(200, { trips: allTrips });
  } catch (err) {
    console.error("GET /trips error:", err);
    return response(500, { message: "Internal server error" });
  }
};
