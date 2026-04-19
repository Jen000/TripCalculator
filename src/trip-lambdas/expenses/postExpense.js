import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TABLE_NAME = process.env.EXPENSES_TABLE;

export const handler = async (event) => {
  try {
    /* ----------------------------------------
       1) Identify the user (Cognito)
    ---------------------------------------- */
    const userSub = getUserSub(event);

    if (!userSub) {
      return response(401, { message: "Unauthorized" });
    }

    /* ----------------------------------------
       2) Parse & validate request body
    ---------------------------------------- */
    if (!event.body) {
      return response(400, { message: "Missing request body" });
    }

    const body = JSON.parse(event.body);

    const {
      tripId,
      date,        // YYYY-MM-DD
      description,
      whoPaid,
      category,
      cost,        // number or string
    } = body;

    
    if (!tripId || typeof tripId !== "string") return response(400, { message: "tripId is required" });
    
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

    /* ----------------------------------------
       3) Build DynamoDB item
    ---------------------------------------- */
    const expenseId = randomUUID();
    const createdAt = new Date().toISOString();

    const item = {
      userSub,                   // PK
      expenseId,                 // SK
      createdAt,                 // attribute (for sorting later)
      tripId,
      date,
      description: description.trim(),
      whoPaid: whoPaid.trim(),
      category: category.trim(),
      costCents: Math.round(costNumber * 100),
    };

    /* ----------------------------------------
       4) Write to DynamoDB
    ---------------------------------------- */
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    /* ----------------------------------------
       5) Return success
    ---------------------------------------- */
    return response(201, {
      message: "Expense created",
      expense: item,
    });

  } catch (err) {
    console.error("POST /expenses error:", err);
    return response(500, { message: "Internal server error" });
  }
};
