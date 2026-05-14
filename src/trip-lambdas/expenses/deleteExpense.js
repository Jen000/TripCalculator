import { DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;
const TRIP_ID_INDEX = "tripId-index";

export const handler = async (event) => {
  // Top-level log visible in CloudWatch even before any DynamoDB call
  console.log("DELETE /expenses/{expenseId} invoked", JSON.stringify({
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
    TABLE_NAME,
  }));

  if (!TABLE_NAME) {
    console.error("EXPENSES_TABLE env var is not set");
    return response(500, { message: "Server misconfigured: EXPENSES_TABLE missing" });
  }

  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const expenseId = event.pathParameters?.expenseId;
    if (!expenseId) return response(400, { message: "Missing expenseId" });

    // The frontend passes tripId as a query param so we can resolve the real
    // owner via the tripId-index GSI. This handles multi-member trips where the
    // expense was created by a different user.
    const tripId = event.queryStringParameters?.tripId;
    let ownerSub = userSub;

    if (tripId) {
      // No Limit here: FilterExpression runs after Limit in DynamoDB, so a Limit
      // of 1 would stop reading before finding the matching expenseId.
      const found = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: TRIP_ID_INDEX,
        KeyConditionExpression: "tripId = :tripId",
        FilterExpression: "expenseId = :expenseId",
        ExpressionAttributeValues: { ":tripId": tripId, ":expenseId": expenseId },
      }));

      if (found.Items && found.Items.length > 0) {
        ownerSub = found.Items[0].userSub;
        console.log("Resolved ownerSub via GSI", { ownerSub, expenseId });
      } else {
        console.warn("Expense not found in GSI", { tripId, expenseId });
        return response(404, { message: "Expense not found" });
      }
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userSub: ownerSub, expenseId },
      ConditionExpression: "attribute_exists(expenseId)",
    }));

    return response(200, { message: "Expense deleted" });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Expense not found" });
    }
    console.error("DELETE /expenses/{expenseId} unhandled error", {
      name: err.name,
      message: err.message,
      code: err.$metadata?.httpStatusCode,
      stack: err.stack,
    });
    return response(500, { message: "Internal server error", detail: err.message });
  }
};
