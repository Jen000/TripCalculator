import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ddb } from "./db.js";
import { response } from "./response.js";
import { getUserSub } from "./auth.js";

const TABLE_NAME = process.env.TRIP_SETTINGS_TABLE;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const cognito = new CognitoIdentityProviderClient({});

export const handler = async (event) => {
  try {
    const userSub = getUserSub(event);
    if (!userSub) return response(401, { message: "Unauthorized" });

    const tripId = event.pathParameters?.tripId;
    if (!tripId) return response(400, { message: "Missing tripId" });

    const body = JSON.parse(event.body ?? "{}");
    const { email } = body;
    if (!email || typeof email !== "string") {
      return response(400, { message: "email is required" });
    }

    // 1. Look up the Cognito user by email
    const cognitoRes = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${email.trim().toLowerCase()}"`,
      Limit: 1,
    }));

    if (!cognitoRes.Users || cognitoRes.Users.length === 0) {
      return response(404, { message: "No account found with that email address." });
    }

    const cognitoUser = cognitoRes.Users[0];
    const invitedSub = cognitoUser.Attributes?.find((a) => a.Name === "sub")?.Value;
    const invitedEmail = cognitoUser.Attributes?.find((a) => a.Name === "email")?.Value ?? email;

    if (!invitedSub) {
      return response(500, { message: "Could not resolve user sub" });
    }

    if (invitedSub === userSub) {
      return response(400, { message: "You can't invite yourself." });
    }

    // 2. Get current settings to check for duplicate
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
    }));

    const currentMembers = existing.Item?.members ?? [];
    if (currentMembers.some((m) => m.userId === invitedSub)) {
      return response(409, { message: "That user is already a member of this trip." });
    }

    // 3. Append new member
    const newMember = {
      userId: invitedSub,
      email: invitedEmail,
      role: "member",
      addedAt: new Date().toISOString(),
    };

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { tripId },
      UpdateExpression: "SET members = list_append(if_not_exists(members, :empty), :newMember), tripId = :tripId",
      ExpressionAttributeValues: {
        ":empty": [],
        ":newMember": [newMember],
        ":tripId": tripId,
      },
    }));

    return response(200, { message: "Member added", member: newMember });
  } catch (err) {
    console.error("POST /trips/{tripId}/members error:", err);
    return response(500, { message: "Internal server error" });
  }
};