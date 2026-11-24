import { isObject, sanitizeDraft, sanitizeResource } from "@/lib/resources/sanitize";
import type { Draft, Resource } from "@/lib/resources/types";

/**
 * A resource version's `content` in the database: the browser workspace's Resource
 * (brief, course and unit names, deliveries) and Draft, as JSON. The database row is
 * the truth for the id, kind, version number and whether it is approved; those are
 * written over whatever the JSON says when it is read back.
 */

export type StoredContent = { resource: Resource; draft: Draft };
export type ResourceRowLike = { id: string; kind: string; title: string; created_at: string; updated_at: string };
export type VersionRowLike = { number: number; approved_at: string | null; content: unknown };

export function readStoredContent(row: ResourceRowLike, version: VersionRowLike): StoredContent | null {
  const content = isObject(version.content) ? version.content : {};
  const rawResource = isObject(content.resource) ? content.resource : {};
  const resource = sanitizeResource({ ...rawResource, id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at });
  if (!resource || resource.kind !== row.kind) return null;
  const draft = sanitizeDraft(content.draft, resource);
  if (!draft) return null;
  const approved = version.approved_at !== null;
  return {
    resource,
    draft: {
      ...draft,
      version: version.number,
      status: approved ? "approved" : "draft",
      approved: approved ? { at: version.approved_at!, version: version.number, title: draft.title, sections: draft.sections } : draft.approved,
      pendingAlt: approved ? null : draft.pendingAlt,
    },
  };
}

/** What a save sends: the material text of the brief is never stored. */
export function toStoredContent(resource: Resource, draft: Draft): StoredContent {
  const brief = { ...resource.brief, material: resource.brief.material ? { ...resource.brief.material, text: "" } : null };
  return { resource: { ...resource, brief }, draft };
}
