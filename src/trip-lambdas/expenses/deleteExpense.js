import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;
const EXPENSES_GSI = process.env.EXPENSES_GSI;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const expenseId = event.pathParameters?.expenseId;
    if (!expenseId) return response(400, { message: "Missing expenseId" });

    // Query by expenseId using GSI to find the actual userSub (owner)
    // Falls back to using the current userSub if no GSI configured
    let ownerSub = userSub;

    if (EXPENSES_GSI) {
      const found = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: EXPENSES_GSI,
        KeyConditionExpression: "expenseId = :expenseId",
        ExpressionAttributeValues: { ":expenseId": expenseId },
        Limit: 1,
      }));
      if (found.Items && found.Items.length > 0) {
        ownerSub = found.Items[0].userSub;
      }
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userSub: ownerSub, expenseId },
    }));

    return response(200, { message: "Expense deleted" });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Expense not found" });
    }
    console.error("DELETE /expenses/{expenseId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};