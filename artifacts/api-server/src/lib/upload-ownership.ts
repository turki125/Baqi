import type { File } from "@google-cloud/storage";
import { getObjectAclPolicy, setObjectAclPolicy } from "./objectAcl";

// Signed upload destinations include their authenticated owner. PUT replaces
// object metadata, so claim private ACLs lazily after the upload completes.
export async function ownsUpload(file: File, objectPath: string, userId: string): Promise<boolean> {
  const policy = await getObjectAclPolicy(file);
  if (policy) return policy.owner === userId;
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) return false;
  const prefix = `/objects/uploads/${userId}/`;
  if (!objectPath.startsWith(prefix) || !/^[0-9a-f-]{36}$/i.test(objectPath.slice(prefix.length))) return false;
  await setObjectAclPolicy(file, { owner: userId, visibility: "private" });
  return true;
}
