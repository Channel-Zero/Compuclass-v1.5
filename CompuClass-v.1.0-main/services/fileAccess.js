import { supabase } from '../config/supabase';
import { AppError } from '../utils/errorMessages';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const SIGNED_URL_SECONDS = 3600;

const DOCUMENT_URL_MARKERS = ['/object/public/documents/', '/object/sign/documents/'];

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

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    throw new Error('Unrecognised file path');
  }
}

function assertObjectPath(path) {
  if (!path || path.split('/').includes('..') || path.includes('\\')) {
    throw new Error('Unrecognised file path');
  }
  return path;
}

// documents.file_url is either an object path (new uploads) or an old public
// URL such as .../object/public/documents/<user>/<file>. The bucket is private,
// so readers must turn either form into the object path before signing.
export function storagePathFromStoredValue(stored) {
  if (typeof stored !== 'string' || !stored.trim()) throw new Error('No file path');
  const value = stored.trim();
  if (!/^https?:\/\//i.test(value)) {
    return assertObjectPath(decodePath(value.replace(/^\/+/, '').split('?')[0].split('#')[0]));
  }

  const lower = value.toLowerCase();
  let foundAt = -1;
  let markerLength = 0;
  DOCUMENT_URL_MARKERS.forEach((marker) => {
    const index = lower.lastIndexOf(marker);
    if (index > foundAt) {
      foundAt = index;
      markerLength = marker.length;
    }
  });
  if (foundAt === -1) throw new Error('Unrecognised file path');
  const raw = value.slice(foundAt + markerLength).split('?')[0].split('#')[0];
  return assertObjectPath(decodePath(raw));
}

export async function createSignedFileUrl(stored, expiresIn = SIGNED_URL_SECONDS) {
  let path;
  try {
    path = storagePathFromStoredValue(stored);
  } catch (error) {
    console.error('Document path error:', error.message);
    throw new AppError('This file could not be opened. Please try again.');
  }
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error('Signed document URL error:', error?.message || 'No signed URL');
    throw new AppError('This file could not be opened. Please try again.');
  }
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
