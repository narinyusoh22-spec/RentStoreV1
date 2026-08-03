import { supabase } from './supabase-client.js';

export async function getFavoriteShopIds(userId) {
  const { data } = await supabase.from('favorites').select('shop_id').eq('customer_id', userId);
  return new Set((data || []).map((f) => f.shop_id));
}

export async function isFavorite(userId, shopId) {
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('customer_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle();
  return !!data;
}

export async function addFavorite(userId, shopId) {
  const { error } = await supabase.from('favorites').insert({ customer_id: userId, shop_id: shopId });
  if (error) throw error;
}

export async function removeFavorite(userId, shopId) {
  const { error } = await supabase.from('favorites').delete().eq('customer_id', userId).eq('shop_id', shopId);
  if (error) throw error;
}

export async function toggleFavorite(userId, shopId, currentlyFavorite) {
  if (currentlyFavorite) {
    await removeFavorite(userId, shopId);
    return false;
  }
  await addFavorite(userId, shopId);
  return true;
}

// full shop rows the customer has favorited, for the "ร้านโปรด" dashboard tab
export async function listFavoriteShops(userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('shop_id, shops:shop_id(id, name, category, cover_url, address, is_active)')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((f) => f.shops).filter(Boolean);
}
