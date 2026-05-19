import { GetCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.TRIP_SETTINGS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

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

    const item = result.Item;
    let members = item?.members ?? [];

    // Dynamically enrich member firstNames so the display name reflects the
    // user's current profile — not just a snapshot taken at invite time.
    if (USERS_TABLE && members.length > 0) {
      try {
        const keys = members
          .map((m) => ({ userSub: m.userId }))
          .filter((k) => k.userSub);

        if (keys.length > 0) {
          const batchRes = await ddb.send(new BatchGetCommand({
            RequestItems: { [USERS_TABLE]: { Keys: keys } },
          }));
          const nameMap = {};
          for (const u of (batchRes.Responses?.[USERS_TABLE] ?? [])) {
            if (u.userSub && u.firstName) nameMap[u.userSub] = u.firstName;
          }
          members = members.map((m) => ({
            ...m,
            firstName: nameMap[m.userId] ?? m.firstName ?? null,
          }));
        }
      } catch (err) {
        console.warn("Could not enrich member firstNames:", err.message);
      }
    }

    return response(200, {
      tripId,
      categories: item?.categories ?? DEFAULT_CATEGORIES,
      totalBudgetCents: item?.totalBudgetCents ?? null,
      categoryBudgets: item?.categoryBudgets ?? [],
      members,
      people: item?.people ?? [],
      splitRules: item?.splitRules ?? { defaultSplit: [], categoryOverrides: [] },
    });
  } catch (err) {
    console.error("GET /trips/{tripId}/settings error:", err);
    return response(500, { message: "Internal server error" });
  }
};
