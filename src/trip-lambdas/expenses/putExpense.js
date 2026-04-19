import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      // userSub is PK, expenseId is SK — matches your existing table schema
      Key: { userSub, expenseId },
      ConditionExpression: "userSub = :sub",
      UpdateExpression: `SET
        #dt = :date,
        description = :description,
        whoPaid = :whoPaid,
        category = :category,
        costCents = :costCents,
        updatedAt = :updatedAt`,
      ExpressionAttributeNames: { "#dt": "date" },
      ExpressionAttributeValues: {
        ":sub": userSub,
        ":date": date,
        ":description": description.trim(),
        ":whoPaid": whoPaid.trim(),
        ":category": category.trim(),
        ":costCents": Math.round(costNumber * 100),
        ":updatedAt": updatedAt,
      },
    }));

    return response(200, {
      message: "Expense updated",
      expense: { expenseId, date, description: description.trim(), whoPaid: whoPaid.trim(), category: category.trim(), costCents: Math.round(costNumber * 100), updatedAt },
    });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Expense not found" });
    }
    console.error("PUT /expenses/{expenseId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};