import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";


const TRIPS_TABLE = process.env.TRIPS_TABLE;
const EXPENSES_TABLE = process.env.EXPENSES_TABLE;
const EXPENSES_GSI = process.env.EXPENSES_GSI || "gsiUserTrip";
const TRIP_SETTINGS_TABLE = process.env.TRIP_SETTINGS_TABLE;
const TRIP_MEMBERSHIPS_TABLE = process.env.TRIP_MEMBERSHIPS_TABLE;

async function batchDelete(tableName, keys) {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    const out = await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
        },
      })
    );

    // If DynamoDB throttles, it returns UnprocessedItems. Retry a couple times.
    let unprocessed = out.UnprocessedItems?.[tableName] ?? [];
    let attempts = 0;
    while (unprocessed.length && attempts < 3) {
      attempts += 1;
      const retry = await ddb.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: unprocessed },
        })
      );
      unprocessed = retry.UnprocessedItems?.[tableName] ?? [];
    }
  }
}

export const handler = async (event) => {
  try {
    if (!TRIPS_TABLE || !EXPENSES_TABLE) {
      return response(500, { message: "Missing env vars TRIPS_TABLE/EXPENSES_TABLE" });
    }

    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event?.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "tripId required" });

    // 0) Look up trip members before deleting anything so we can clean
    // up TripMemberships rows at the end.
    let memberSubsToClean = [];
    if (TRIP_MEMBERSHIPS_TABLE && TRIP_SETTINGS_TABLE) {
      try {
        const settings = await ddb.send(new GetCommand({
          TableName: TRIP_SETTINGS_TABLE,
          Key: { tripId },
        }));
        memberSubsToClean = (settings.Item?.members ?? [])
          .map((m) => m.userId)
          .filter(Boolean);
      } catch (err) {
        console.warn("Could not fetch trip members for cleanup:", err.message);
      }
    }

    // 1) Delete the trip row
    await ddb.send(
      new DeleteCommand({
        TableName: TRIPS_TABLE,
        Key: { userSub, tripId },
      })
    );

    // 2) Fetch all expenses for this user+trip (via GSI)
    let keysToDelete = [];
    let ExclusiveStartKey;

    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: EXPENSES_TABLE,
          IndexName: EXPENSES_GSI,
          KeyConditionExpression: "userSub = :u AND tripId = :t",
          ExpressionAttributeValues: { ":u": userSub, ":t": tripId },
          ProjectionExpression: "userSub, expenseId",
          ExclusiveStartKey,
        })
      );

      const batch = (res.Items ?? []).map((x) => ({
        userSub: x.userSub,
        expenseId: x.expenseId,
      }));

      keysToDelete = keysToDelete.concat(batch);
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    // 3) Delete expenses in batches
    if (keysToDelete.length) {
      await batchDelete(EXPENSES_TABLE, keysToDelete);
    }

    // 4) Clean up TripMemberships rows for the (now-deleted) trip's members.
    if (TRIP_MEMBERSHIPS_TABLE && memberSubsToClean.length) {
      const membershipKeys = memberSubsToClean.map((memberSub) => ({
        userSub: memberSub,
        tripId,
      }));
      try {
        await batchDelete(TRIP_MEMBERSHIPS_TABLE, membershipKeys);
      } catch (err) {
        console.warn("TripMemberships cleanup failed:", err.message);
      }
    }

    return response(200, {
      message: "Trip deleted",
      deletedExpenses: keysToDelete.length,
    });
  } catch (err) {
    console.error("DELETE /trips/{tripId} error:", err);
    return response(500, { message: err?.message || "Internal server error" });
  }
};
