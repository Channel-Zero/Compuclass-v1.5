// Lecturer files are stored as ${userId}/${timestamp}_${fileName}.
// Profile photos are ${userId}/avatar_${timestamp}.jpg in the same bucket.
export function buildDocumentObjectPath(userId, fileName, now = Date.now()) {
  return `${userId}/${now}_${fileName}`;
}

export function isOwnDocumentPath(path, userId) {
  const parts = String(path || '').split('/');
  return parts.length >= 2 && parts[0] === String(userId) && parts.slice(1).join('/').length > 0;
}

export function isOwnAvatarPath(path, userId) {
  const parts = String(path || '').split('/');
  return parts.length === 2 && parts[0] === String(userId) && parts[1].startsWith('avatar_');
}
