import { randomUUID } from "node:crypto";

export const newId = (prefix = ""): string => `${prefix}${randomUUID().replace(/-/g, "").slice(0, 20)}`;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
