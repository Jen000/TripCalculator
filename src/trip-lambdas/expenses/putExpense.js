import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const expenseId = event.pathParameters?.expenseId;
    if (!expenseId) return response(400, { message: "Missing expenseId" });

    const body = JSON.parse(event.body ?? "{}");
    const { date, description, whoPaid, category, cost } = body;

    if (!date || !description || !whoPaid || !category || cost == null) {
      return response(400, { message: "Missing required fields" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return response(400, { message: "Invalid date format" });
    }
    const costNumber = Number(cost);
    if (!Number.isFinite(costNumber) || costNumber < 0) {
      return response(400, { message: "Invalid cost" });
    }

    const updatedAt = new Date().toISOString();

    // Expenses are keyed by (userSub, expenseId). Use the caller's userSub directly.
    // ConditionExpression ensures we return 404 instead of silently creating a ghost record.
    // ReturnValues: "ALL_NEW" gives back all attributes (including tripId, createdAt) so the
    // frontend can keep its state fully consistent after an edit.
    const result = await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userSub, expenseId },
      ConditionExpression: "attribute_exists(expenseId)",
      UpdateExpression: `SET #dt = :date, description = :description, whoPaid = :whoPaid,
        category = :category, costCents = :costCents, updatedAt = :updatedAt`,
      ExpressionAttributeNames: { "#dt": "date" },
      ExpressionAttributeValues: {
        ":date": date,
        ":description": description.trim(),
        ":whoPaid": whoPaid.trim(),
        ":category": category.trim(),
        ":costCents": Math.round(costNumber * 100),
        ":updatedAt": updatedAt,
      },
      ReturnValues: "ALL_NEW",
    }));

    return response(200, {
      message: "Expense updated",
      expense: result.Attributes,
    });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Expense not found" });
    }
    console.error("PUT /expenses/{expenseId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};
