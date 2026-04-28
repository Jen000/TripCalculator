import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.USERS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const result = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userSub },
    }));

    return response(200, {
      userSub,
      firstName: result.Item?.firstName ?? null,
    });
  } catch (err) {
    console.error("GET /users/me error:", err);
    return response(500, { message: "Internal server error" });
  }
};