import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const handler = async (event) => {
  try {
    if (!TABLE_NAME) {
      return response(500, { message: "Server misconfigured: EXPENSES_TABLE missing" });
    }

    // 1) Auth: get userSub
    const userSub = getUserSub(event);
    if (!userSub) {
      return response(401, { message: "Unauthorized" });
    }

    // 2) Read optional query params
    const qs = event.queryStringParameters || {};
    const from = qs.from;
    const to = qs.to;
    const tripId = qs.tripId;

    if ((from && !isValidDateStr(from)) || (to && !isValidDateStr(to))) {
      return response(400, { message: "Invalid date range. Use ?from=YYYY-MM-DD&to=YYYY-MM-DD" });
    }

    // 3) Query DynamoDB by partition key (userSub), filter by tripId if provided
    const expressionValues = { ":u": userSub };
    if (tripId) expressionValues[":tripId"] = tripId;

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "userSub = :u",
        ...(tripId ? { FilterExpression: "tripId = :tripId" } : {}),
        ExpressionAttributeValues: expressionValues,
      })
    );

    let items = result.Items ?? [];

    // 4) Optional date filtering
    if (from) items = items.filter((x) => typeof x.date === "string" && x.date >= from);
    if (to) items = items.filter((x) => typeof x.date === "string" && x.date <= to);

    // 5) Sort newest-first by createdAt
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return response(200, { expenses: items });
  } catch (err) {
    console.error("GET /expenses error:", err);
    return response(500, { message: "Internal server error" });
  }
};