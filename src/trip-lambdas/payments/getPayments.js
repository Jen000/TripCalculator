import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TABLE_NAME = process.env.PAYMENTS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "tripId-index",
      KeyConditionExpression: "tripId = :tripId",
      ExpressionAttributeValues: { ":tripId": tripId },
    }));

    const payments = (result.Items ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    return response(200, { payments });
  } catch (err) {
    console.error("GET /trips/{tripId}/payments error:", err);
    return response(500, { message: "Internal server error" });
  }
};