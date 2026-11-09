import { supabase, unwrap } from '@/lib/supabase';
import type { Yacht, YachtPhoto } from '@/types/models';

const SELECT = '*, photos:yacht_photos(id, yacht_id, url, storage_path, position)';

function sortPhotos(y: Yacht): Yacht {
  return { ...y, photos: [...(y.photos ?? [])].sort((a, b) => a.position - b.position) };
}

export async function fetchYachts(orgId: string, includeArchived = false): Promise<Yacht[]> {
  let q = supabase.from('yachts').select(SELECT).eq('org_id', orgId).order('name');
  if (!includeArchived) q = q.neq('status', 'archived');
  return (unwrap(await q) as Yacht[]).map(sortPhotos);
}

export async function fetchYacht(id: string): Promise<Yacht> {
  return sortPhotos(unwrap(await supabase.from('yachts').select(SELECT).eq('id', id).single()) as Yacht);
}

export type YachtInput = Pick<
  Yacht,
  'name' | 'yacht_type' | 'length_m' | 'capacity' | 'home_marina' | 'description' | 'registration_number' | 'status'
>;

export async function createYacht(orgId: string, input: YachtInput): Promise<Yacht> {
  return unwrap(await supabase.from('yachts').insert({ ...input, org_id: orgId }).select().single()) as Yacht;
}

export async function updateYacht(id: string, patch: Partial<YachtInput>): Promise<Yacht> {
  return unwrap(await supabase.from('yachts').update(patch).eq('id', id).select().single()) as Yacht;
}

export async function deleteYacht(id: string) {
  unwrap(await supabase.from('yachts').delete().eq('id', id));
}

/** Uploads a local image (file:// or content:// URI) to Storage and registers it on the yacht. */
export async function addYachtPhoto(orgId: string, yachtId: string, localUri: string, position: number) {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${orgId}/${yachtId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext === 'png' || ext === 'webp' ? ext : 'jpg'}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  unwrap(await supabase.storage.from('yacht-photos').upload(path, body, { contentType, upsert: false }));
  const url = supabase.storage.from('yacht-photos').getPublicUrl(path).data.publicUrl;
  return unwrap(
    await supabase.from('yacht_photos').insert({ yacht_id: yachtId, url, storage_path: path, position }).select().single(),
  ) as YachtPhoto;
}

export async function removeYachtPhoto(photo: YachtPhoto) {
  if (photo.storage_path) await supabase.storage.from('yacht-photos').remove([photo.storage_path]);
  unwrap(await supabase.from('yacht_photos').delete().eq('id', photo.id));
}

export async function uploadAvatar(userId: string, localUri: string) {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const body = await (await fetch(localUri)).arrayBuffer();
  unwrap(await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: true }));
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
