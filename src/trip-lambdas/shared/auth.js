export function getUserSub(event) {
  return event?.requestContext?.authorizer?.jwt?.claims?.sub ?? null;
}