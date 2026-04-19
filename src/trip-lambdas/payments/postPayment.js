import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb } from "../shared/db.js";
import { response } from "../shared/response.js";
import { getUserSub } from "../shared/auth.js";

const TABLE_NAME = process.env.PAYMENTS_TABLE;

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const body = JSON.parse(event.body ?? "{}");
    const { fromUser, toUser, amountCents, note } = body;

    if (!fromUser || !toUser) return response(400, { message: "fromUser and toUser are required" });

    const amount = Number(amountCents);
    if (!Number.isFinite(amount) || amount <= 0) {
      return response(400, { message: "Invalid amountCents" });
    }

    const payment = {
      paymentId: randomUUID(),
      tripId,
      fromUser: fromUser.trim(),
      toUser: toUser.trim(),
      amountCents: Math.round(amount),
      note: note?.trim() ?? null,
      recordedBy: userSub,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: payment,
    }));

    return response(201, { message: "Payment recorded", payment });
  } catch (err) {
    console.error("POST /trips/{tripId}/payments error:", err);
    return response(500, { message: "Internal server error" });
  }
};