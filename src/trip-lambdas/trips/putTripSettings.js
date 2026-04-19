import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TABLE_NAME = process.env.TRIP_SETTINGS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const body = JSON.parse(event.body ?? "{}");
    const { categories, totalBudgetCents, categoryBudgets } = body;

    // Build update expression dynamically — only update what was sent
    const updates = [];
    const names = {};
    const values = { ":updatedAt": new Date().toISOString(), ":tripId": tripId };
    updates.push("updatedAt = :updatedAt", "tripId = :tripId");

    if (categories !== undefined) {
      if (!Array.isArray(categories)) return response(400, { message: "categories must be an array" });
      updates.push("categories = :categories");
      values[":categories"] = categories.map((c) => String(c).trim()).filter(Boolean);
    }

    if (totalBudgetCents !== undefined) {
      if (totalBudgetCents !== null && (!Number.isFinite(totalBudgetCents) || totalBudgetCents < 0)) {
        return response(400, { message: "Invalid totalBudgetCents" });
      }
      updates.push("totalBudgetCents = :totalBudgetCents");
      values[":totalBudgetCents"] = totalBudgetCents;
    }

    if (categoryBudgets !== undefined) {
      if (!Array.isArray(categoryBudgets)) return response(400, { message: "categoryBudgets must be an array" });
      updates.push("categoryBudgets = :categoryBudgets");
      values[":categoryBudgets"] = categoryBudgets;
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    }));

    return response(200, { message: "Settings saved", tripId });
  } catch (err) {
    console.error("PUT /trips/{tripId}/settings error:", err);
    return response(500, { message: "Internal server error" });
  }
};