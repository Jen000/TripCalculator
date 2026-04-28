import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.TRIP_SETTINGS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    const targetUserId = event.pathParameters?.userId;
    if (!tripId || !targetUserId) return response(400, { message: "Missing tripId or userId" });

    // Get current members list
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
    }));

    const members = existing.Item?.members ?? [];
    const filtered = members.filter((m) => m.userId !== targetUserId);

    if (filtered.length === members.length) {
      return response(404, { message: "Member not found" });
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
      UpdateExpression: "SET members = :members",
      ExpressionAttributeValues: { ":members": filtered },
    }));

    return response(200, { message: "Member removed" });
  } catch (err) {
    console.error("DELETE /trips/{tripId}/members/{userId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};