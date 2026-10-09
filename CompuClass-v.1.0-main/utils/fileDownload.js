import { Platform } from 'react-native';
// The download/read/write functions were moved to the legacy entry point in
// expo-file-system 54+; importing them from 'expo-file-system' throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AppError } from './errorMessages';
import { sanitizeFileName } from './inputValidation';

const isSafeRemoteUrl = (url) => typeof url === 'string' && /^https:\/\//i.test(url.trim());

// Opens a stored document. Native: download, then open the share sheet so the
// user can view/save it. Web: expo-file-system has no web support, so open the
// file in a new browser tab.
// Returns 'opened' (web), 'shared', or 'downloaded' (native, no share sheet).
export async function openRemoteDocument(url, fileName) {
  // file_url comes from the database; only ever open real https links
  // (a "javascript:" URL here would run script on the web build).
  if (!isSafeRemoteUrl(url)) throw new AppError('This document link is not valid.');

  if (Platform.OS === 'web') {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened === null) throw new AppError('Your browser blocked the download. Please allow pop-ups for this site and try again.');
    return 'opened';
  }

  const target = `${FileSystem.documentDirectory}${sanitizeFileName(fileName, 'document.pdf')}`;
  const result = await FileSystem.downloadAsync(url, target);
  if (result.status !== 200) throw new AppError('Download failed. Please try again.');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri);
    return 'shared';
  }
  return 'downloaded';
}

// Saves generated text (e.g. a JSON data export). Web: browser download.
// Native: write to the app's documents folder and open the share sheet.
// Returns 'downloaded' (web), 'shared', or the saved file URI.
export async function saveTextFile(fileName, contents, mimeType = 'application/json') {
  const safeName = sanitizeFileName(fileName, 'export.json');

  if (Platform.OS === 'web') {
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return 'downloaded';
  }

  const fileUri = `${FileSystem.documentDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(fileUri, contents);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType });
    return 'shared';
  }
  return fileUri;
}
