import { QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/db.js";
import { getUserSub } from "../shared/auth.js";

const EXPENSES_TABLE = process.env.EXPENSES_TABLE;
const EXPENSES_GSI = process.env.EXPENSES_GSI || "gsiUserTrip";

function responseCsv(statusCode, filename, csv) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Allow-Origin": "*",
    },
    body: csv,
  };
}

function responseJson(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function batchGetAll(tableName, keys) {
  const results = [];

  for (let i = 0; i < keys.length; i += 100) {
    let request = {
      RequestItems: {
        [tableName]: { Keys: keys.slice(i, i + 100) },
      },
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await ddb.send(new BatchGetCommand(request));
      results.push(...(res.Responses?.[tableName] ?? []));

      const unprocessed = res.UnprocessedKeys?.[tableName]?.Keys ?? [];
      if (!unprocessed.length) break;

      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
      request = { RequestItems: { [tableName]: { Keys: unprocessed } } };
    }
  }

  return results;
}

export const handler = async (event) => {
  try {
    if (!EXPENSES_TABLE) {
      return responseJson(500, { message: "Server misconfigured: EXPENSES_TABLE missing" });
    }

    const userSub = getUserSub(event);
    if (!userSub) return responseJson(401, { message: "Unauthorized" });

    const tripId = event?.pathParameters?.tripId;
    if (!tripId) return responseJson(400, { message: "tripId is required" });

    // 1) Query KEYS_ONLY GSI for keys
    const keys = [];
    let ExclusiveStartKey;

    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: EXPENSES_TABLE,
          IndexName: EXPENSES_GSI,
          KeyConditionExpression: "userSub = :u AND tripId = :t",
          ExpressionAttributeValues: {
            ":u": userSub,
            ":t": tripId,
          },
          ProjectionExpression: "userSub, expenseId",
          ExclusiveStartKey,
        })
      );

      keys.push(
        ...(res.Items ?? []).map((x) => ({ userSub: x.userSub, expenseId: x.expenseId }))
      );

      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const filename = `trip-${tripId}-expenses.csv`;

    if (keys.length === 0) {
      const emptyCsv = "date,description,whoPaid,category,cost,createdAt,expenseId\n";
      return responseCsv(200, filename, emptyCsv);
    }

    // 2) BatchGet full items from base table
    const expenses = await batchGetAll(EXPENSES_TABLE, keys);

    // Sort oldest -> newest (or flip if you prefer)
    expenses.sort((a, b) => {
      const aKey = a.createdAt ?? `${a.date}T00:00:00.000Z`;
      const bKey = b.createdAt ?? `${b.date}T00:00:00.000Z`;
      return aKey.localeCompare(bKey);
    });

    // 3) Build CSV
    const header = ["date", "description", "whoPaid", "category", "cost", "createdAt", "expenseId"];
    const lines = [header.join(",")];

    for (const e of expenses) {
      const costDollars =
        typeof e.costCents === "number" ? (e.costCents / 100).toFixed(2) : "";

      lines.push(
        [
          csvEscape(e.date),
          csvEscape(e.description),
          csvEscape(e.whoPaid),
          csvEscape(e.category),
          csvEscape(costDollars),
          csvEscape(e.createdAt),
          csvEscape(e.expenseId),
        ].join(",")
      );
    }

    return responseCsv(200, filename, lines.join("\n") + "\n");
  } catch (err) {
    console.error("EXPORT /trips/{tripId}/export error:", err);
    return responseJson(500, { message: err?.message || "Internal server error" });
  }
};
