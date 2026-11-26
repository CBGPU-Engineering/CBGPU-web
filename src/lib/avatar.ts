/**
 * The server decides which picture a person shows (their uploaded photo, otherwise a default
 * avatar built from an opaque per-account seed). Clients only render what the server returns and
 * never build avatar-provider URLs themselves, so style and version cannot drift between clients.
 */
export const AVATAR_PROFILE_COLUMNS = 'display_avatar_url,profile_image_url';

type AvatarFields = { display_avatar_url?: string | null; profile_image_url?: string | null; avatarUrl?: string | null; avatar_url?: string | null } | null | undefined;

/** The URL to draw. `avatar_url` only covers a server that has not applied the avatar migration yet. */
export function avatarSrc(person: AvatarFields): string | null {
  return person?.display_avatar_url ?? person?.avatarUrl ?? person?.avatar_url ?? null;
}

/** The photo the person uploaded themselves; decides whether "delete photo" is offered. */
export function uploadedPhoto(person: AvatarFields): string | null {
  const value = person?.profile_image_url !== undefined ? person.profile_image_url : person?.avatar_url;
  return value && value.trim() ? value : null;
}
