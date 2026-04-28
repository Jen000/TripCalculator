import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.TRIP_SETTINGS_TABLE;

const DEFAULT_CATEGORIES = [
  "Lodging", "Gas", "Food", "Coffee", "Groceries", "Activities",
  "Park Fees", "Transit / Parking", "Shopping", "Flights", "Rental Car", "Misc",
];

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const result = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
    }));

    // If no settings saved yet, return sensible defaults
    const item = result.Item;
    return response(200, {
      tripId,
      categories: item?.categories ?? DEFAULT_CATEGORIES,
      totalBudgetCents: item?.totalBudgetCents ?? null,
      categoryBudgets: item?.categoryBudgets ?? [],
      members: item?.members ?? [],
    });
  } catch (err) {
    console.error("GET /trips/{tripId}/settings error:", err);
    return response(500, { message: "Internal server error" });
  }
};