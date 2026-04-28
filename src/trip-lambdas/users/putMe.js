import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.USERS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const body = JSON.parse(event.body ?? "{}");
    const { firstName } = body;

    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      return response(400, { message: "firstName is required" });
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userSub },
      UpdateExpression: "SET firstName = :firstName, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":firstName": firstName.trim(),
        ":updatedAt": new Date().toISOString(),
      },
    }));

    return response(200, {
      message: "Profile updated",
      userSub,
      firstName: firstName.trim(),
    });
  } catch (err) {
    console.error("PUT /users/me error:", err);
    return response(500, { message: "Internal server error" });
  }
};