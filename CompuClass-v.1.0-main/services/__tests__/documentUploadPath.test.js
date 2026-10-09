import { buildDocumentObjectPath, isOwnAvatarPath, isOwnDocumentPath } from '../documentUploadPath';

describe('document upload paths', () => {
  it('keeps lecturer uploads inside that lecturer folder', () => {
    const path = buildDocumentObjectPath('user-1', 'notes.pdf', 1700000000000);
    expect(path).toBe('user-1/1700000000000_notes.pdf');
    expect(isOwnDocumentPath(path, 'user-1')).toBe(true);
    expect(isOwnDocumentPath(path, 'other-user')).toBe(false);
  });

  it('treats only the caller avatar file as an avatar upload', () => {
    expect(isOwnAvatarPath('user-1/avatar_1700000000000.jpg', 'user-1')).toBe(true);
    expect(isOwnAvatarPath('user-1/1700000000000_notes.pdf', 'user-1')).toBe(false);
    expect(isOwnAvatarPath('other-user/avatar_1.jpg', 'user-1')).toBe(false);
    expect(isOwnAvatarPath('user-1/nested/avatar_1.jpg', 'user-1')).toBe(false);
  });
});