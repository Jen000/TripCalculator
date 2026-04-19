import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const expenseId = event.pathParameters?.expenseId;
    if (!expenseId) return response(400, { message: "Missing expenseId" });

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userSub, expenseId },
      ConditionExpression: "userSub = :sub",
      ExpressionAttributeValues: { ":sub": userSub },
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