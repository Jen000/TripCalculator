import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.TRIPS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const body = JSON.parse(event.body ?? "{}");
    const { name } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return response(400, { message: "name is required" });
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userSub, tripId },
      // Only let the owner rename — ConditionExpression ensures row exists for this user
      ConditionExpression: "userSub = :sub",
      UpdateExpression: "SET #n = :name, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: {
        ":sub": userSub,
        ":name": name.trim(),
        ":updatedAt": new Date().toISOString(),
      },
    }));

    return response(200, { message: "Trip renamed" });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Trip not found" });
    }
    console.error("PUT /trips/{tripId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};