import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.PAYMENTS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const paymentId = event.pathParameters?.paymentId;
    if (!paymentId) return response(400, { message: "Missing paymentId" });

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { paymentId },
    }));

    return response(200, { message: "Payment deleted" });
  } catch (err) {
    console.error("DELETE payments/{paymentId} error:", err);
    return response(500, { message: "Internal server error" });
  }
};