// lib/payload-client.ts
// Singleton helper for accessing the Payload SDK from server code.
// Usage: const payload = await getPayload();
import { getPayload as getPayloadBase } from "payload";
import config from "@payload-config";

export const getPayload = () => getPayloadBase({ config });
