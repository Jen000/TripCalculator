import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TRIPS_TABLE = process.env.TRIPS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const result = await ddb.send(
      new QueryCommand({
        TableName: TRIPS_TABLE,
        KeyConditionExpression: "userSub = :u",
        ExpressionAttributeValues: {
          ":u": userSub,
        },
      })
    );

    console.log("GET /trips userSub:", userSub);

    const trips = result.Items ?? [];
    // newest-first by createdAt (optional)
    trips.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return response(200, { trips });
  } catch (err) {
    console.error("GET /trips error:", err);
    return response(500, { message: "Internal server error" });
  }
};
