import { storagePathFromStoredValue, createSignedFileUrl, SIGNED_URL_SECONDS } from '../fileAccess';
import { supabase } from '../../config/supabase';
import { openStoredDocument } from '../../utils/fileDownload';

jest.mock('../../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  downloadAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(),
}));

const PUBLIC_URL = 'https://proj.supabase.co/storage/v1/object/public/documents/lecturer-1/171000_notes.pdf';

describe('storagePathFromStoredValue', () => {
  it('strips the public documents prefix from an old file_url', () => {
    expect(storagePathFromStoredValue(PUBLIC_URL)).toBe('lecturer-1/171000_notes.pdf');
  });

  it('drops a query string and decodes the object path', () => {
    const stored = 'https://proj.supabase.co/storage/v1/object/public/documents/lecturer-1/my%20notes.pdf?download=1';
    expect(storagePathFromStoredValue(stored)).toBe('lecturer-1/my notes.pdf');
  });

  it('keeps an object path stored for a new upload', () => {
    expect(storagePathFromStoredValue('lecturer-1/171000_notes.pdf')).toBe('lecturer-1/171000_notes.pdf');
    expect(storagePathFromStoredValue('/lecturer-1/171000_notes.pdf')).toBe('lecturer-1/171000_notes.pdf');
  });

  it('rejects a URL that is not in the documents bucket', () => {
    expect(() => storagePathFromStoredValue('https://example.com/files/notes.pdf')).toThrow('Unrecognised file path');
  });

  it('rejects a path that climbs out of the user folder', () => {
    expect(() => storagePathFromStoredValue('lecturer-1/../../other/notes.pdf')).toThrow('Unrecognised file path');
  });
});

describe('createSignedFileUrl', () => {
  beforeEach(() => {
    supabase.storage.from.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('signs the derived object path for one hour', async () => {
    const createSignedUrl = jest.fn(async () => ({ data: { signedUrl: 'https://proj.supabase.co/storage/v1/object/sign/documents/lecturer-1/171000_notes.pdf?token=abc' }, error: null }));
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    await expect(createSignedFileUrl(PUBLIC_URL)).resolves.toContain('/object/sign/documents/');
    expect(supabase.storage.from).toHaveBeenCalledWith('documents');
    expect(createSignedUrl).toHaveBeenCalledWith('lecturer-1/171000_notes.pdf', SIGNED_URL_SECONDS);
    expect(SIGNED_URL_SECONDS).toBe(3600);
  });

  it('tells the user when signing fails and does not open the old public URL', async () => {
    const createSignedUrl = jest.fn(async () => ({ data: null, error: { message: 'Object not found' } }));
    supabase.storage.from.mockReturnValue({ createSignedUrl });
    const FileSystem = require('expo-file-system/legacy');

    await expect(openStoredDocument(PUBLIC_URL, 'notes.pdf')).rejects.toThrow('This file could not be opened. Please try again.');
    expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
  });
});
