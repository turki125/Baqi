import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

// Resolve only public profile names, never expose an email address as a name.
const names = new Map<string, { value: string | null; expires: number }>();
const requests = new Map<string, Promise<string | null>>();

export async function memberDisplayName(userId: string, fallback: string): Promise<string> {
  if (!userId.startsWith("user_")) return fallback;
  const cached = names.get(userId);
  if (cached && cached.expires > Date.now()) return cached.value || fallback;

  let request = requests.get(userId);
  if (!request) {
    request = (async () => {
      try {
        const user = await clerkClient.users.getUser(userId);
        const value = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
          || user.username?.trim() || null;
        if (names.size >= 500) names.delete(names.keys().next().value!);
        names.set(userId, { value, expires: Date.now() + 5 * 60_000 });
        return value;
      } catch {
        logger.warn("Public member name unavailable; retaining the existing role label");
        names.set(userId, { value: null, expires: Date.now() + 30_000 });
        return null;
      } finally {
        requests.delete(userId);
      }
    })();
    requests.set(userId, request);
  }
  return (await request) || fallback;
}
