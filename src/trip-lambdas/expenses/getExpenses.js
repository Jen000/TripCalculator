import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;
const TRIP_ID_INDEX = "tripId-index";

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const handler = async (event) => {
  try {
    if (!TABLE_NAME) {
      return response(500, { message: "Server misconfigured: EXPENSES_TABLE missing" });
    }

    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const qs = event.queryStringParameters || {};
    const from = qs.from;
    const to = qs.to;
    const tripId = qs.tripId;

    if (!tripId) {
      return response(400, { message: "tripId is required" });
    }

    if ((from && !isValidDateStr(from)) || (to && !isValidDateStr(to))) {
      return response(400, { message: "Invalid date range. Use ?from=YYYY-MM-DD&to=YYYY-MM-DD" });
    }

    // Query all expenses for this trip directly via the tripId GSI
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: TRIP_ID_INDEX,
      KeyConditionExpression: "tripId = :tripId",
      ExpressionAttributeValues: { ":tripId": tripId },
    }));

    let items = result.Items ?? [];

    // Optional date filtering
    if (from) items = items.filter((x) => typeof x.date === "string" && x.date >= from);
    if (to) items = items.filter((x) => typeof x.date === "string" && x.date <= to);

    // Sort newest-first by createdAt
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return response(200, { expenses: items });
  } catch (err) {
    console.error("GET /expenses error:", err);
    return response(500, { message: "Internal server error" });
  }
};