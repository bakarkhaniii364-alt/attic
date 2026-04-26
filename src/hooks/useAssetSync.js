import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';

/**
 * useAssetSync - Specialized hook for room assets (Doodles, Images)
 * Fetches assets from shared_assets table and handles storage uploads.
 */
export function useAssetSync(roomId, assetType = null) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Assets
  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    const fetchAssets = async () => {
      let query = supabase
        .from('shared_assets')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (assetType) {
        query = query.eq('type', assetType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ASSETS] Fetch error:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (mounted) {
        setAssets(data || []);
        setLoading(false);
      }
    };

    fetchAssets();

    // 2. Realtime Updates
    const channelName = `room_assets_${roomId}_${assetType || 'all'}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'shared_assets', 
          filter: `room_id=eq.${roomId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Only add if it matches our filtered type (or if we are listening to all)
            if (!assetType || payload.new.type === assetType) {
              setAssets(prev => [payload.new, ...prev]);
            }
          } else if (payload.eventType === 'DELETE') {
            setAssets(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, assetType]);

  // 3. Upload & Save Asset
  const uploadAsset = useCallback(async (fileBlob, type, ownerId, metadata = {}) => {
    if (!roomId) return;

    // A. Upload to Supabase Storage
    const fileExt = fileBlob.type.split('/')[1] || 'png';
    const fileName = `${roomId}/${Date.now()}.${fileExt}`;
    const bucket = type === 'doodle' ? 'doodles' : 'scrapbook';

    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBlob, { cacheControl: '3600', upsert: true });

    if (storageError) {
      console.error('[ASSETS] Storage upload error:', storageError);
      throw storageError;
    }

    // B. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // C. Save to shared_assets table
    const { data: assetData, error: assetError } = await supabase
      .from('shared_assets')
      .insert({
        room_id: roomId,
        owner_id: ownerId,
        type,
        url: publicUrl,
        metadata
      })
      .select()
      .single();

    if (assetError) {
      console.error('[ASSETS] DB save error:', assetError);
      throw assetError;
    }

    return assetData;
  }, [roomId]);

  return { assets, uploadAsset, loading };
}
