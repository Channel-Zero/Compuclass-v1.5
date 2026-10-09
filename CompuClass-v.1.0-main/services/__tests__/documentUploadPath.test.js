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

  it('rejects another user folder, a bare folder, and an empty path', () => {
    expect(isOwnDocumentPath('other-user/1_notes.pdf', 'user-1')).toBe(false);
    expect(isOwnDocumentPath('user-1', 'user-1')).toBe(false);
    expect(isOwnDocumentPath('', 'user-1')).toBe(false);
    expect(isOwnDocumentPath('user-1/1_notes.pdf', '')).toBe(false);
  });

  it('builds a lecturer document path that is not the avatar exception', () => {
    const path = buildDocumentObjectPath('lecturer-1', 'notes.pdf', 1700000000000);
    expect(path.split('/')[0]).toBe('lecturer-1');
    expect(isOwnDocumentPath(path, 'lecturer-1')).toBe(true);
    expect(isOwnDocumentPath(path, 'student-2')).toBe(false);
    expect(isOwnAvatarPath(path, 'lecturer-1')).toBe(false);
  });
});