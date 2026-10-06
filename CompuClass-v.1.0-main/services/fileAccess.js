import { supabase } from '../config/supabase';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'doc', 'docx', 'ppt', 'pptx'];

export function assertUploadAllowed(file) {
  if (file?.size && file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File must be 20 MB or smaller');
  }
  const name = String(file?.name || file?.uri || '').toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop().split('?')[0] : '';
  if (extension && !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('This file type is not allowed');
  }
}

export function storagePathFromStoredValue(stored) {
  if (!stored) throw new Error('No file path');
  if (!stored.startsWith('http')) return decodeURIComponent(stored.replace(/^\/+/, ''));
  const marker = '/documents/';
  const index = stored.indexOf(marker);
  if (index === -1) throw new Error('Unrecognised file path');
  return decodeURIComponent(stored.slice(index + marker.length).split('?')[0]);
}

export async function createSignedFileUrl(stored, expiresIn = 60 * 30) {
  const path = storagePathFromStoredValue(stored);
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function recordMaterialView(documentId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !documentId) return;
  const { error } = await supabase.from('material_views').upsert(
    { user_id: user.id, document_id: documentId, created_at: new Date().toISOString() },
    { onConflict: 'user_id,document_id' },
  );
  if (error) console.error('Material view error:', error.message);
}
