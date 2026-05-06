import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TRIPS_TABLE = process.env.TRIPS_TABLE;
const TRIP_SETTINGS_TABLE = process.env.TRIP_SETTINGS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    // 1. Get trips the user owns
    const ownedResult = await ddb.send(new QueryCommand({
      TableName: TRIPS_TABLE,
      KeyConditionExpression: "userSub = :u",
      ExpressionAttributeValues: { ":u": userSub },
    }));
    const ownedTrips = ownedResult.Items ?? [];
    const ownedTripIds = new Set(ownedTrips.map((t) => t.tripId));

    // 2. Scan TripSettings to find trips where this user is an invited member
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
        console.warn("Could not fetch shared trips:", err.message);
      }
    }

    // 3. Merge, deduplicate, sort newest first
    const allTrips = [...ownedTrips, ...sharedTrips];
    allTrips.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return response(200, { trips: allTrips });
  } catch (err) {
    console.error("GET /trips error:", err);
    return response(500, { message: "Internal server error" });
  }
};