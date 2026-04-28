import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TRIPS_TABLE = process.env.TRIPS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    if (!event.body) return response(400, { message: "Missing body" });
    const { name } = JSON.parse(event.body);

    if (!name || typeof name !== "string" || !name.trim()) {
      return response(400, { message: "Trip name is required" });
    }

    const tripId = randomUUID();
    const createdAt = new Date().toISOString();

    const trip = {
      userSub,     // PK
      tripId,      // SK
      name: name.trim(),
      createdAt,
    };

    await ddb.send(
      new PutCommand({
        TableName: TRIPS_TABLE,
        Item: trip,
        // Optional safety: prevent accidental overwrite
        ConditionExpression: "attribute_not_exists(userSub) AND attribute_not_exists(tripId)",
      })
    );

    return response(201, { trip });
  } catch (err) {
    console.error("POST /trips error:", err);

    // If ConditionExpression fails, DynamoDB throws ConditionalCheckFailedException
    if (err?.name === "ConditionalCheckFailedException") {
      return response(409, { message: "Trip already exists" });
    }

    return response(500, { message: "Internal server error" });
  }
};
