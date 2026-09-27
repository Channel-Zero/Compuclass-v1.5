import { showWebAlert } from '../webAlert';
import { formatTitle, PAGE_META } from '../pageMeta';
import { getSidebarWidth, getSidebarHiddenX } from '../../components/Sidebar';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/', downloadAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));

describe('showWebAlert (Alert.alert replacement on web)', () => {
  const dialogs = (confirmResult = true) => ({ alert: jest.fn(), confirm: jest.fn(() => confirmResult) });

  it('shows simple messages and runs a single OK button', () => {
    const d = dialogs();
    const onOk = jest.fn();
    showWebAlert('Success', 'Account created!', [{ text: 'OK', onPress: onOk }], d);
    expect(d.alert).toHaveBeenCalledWith('Success\n\nAccount created!');
    expect(onOk).toHaveBeenCalled();
  });

  it('runs the destructive action when a confirm dialog is accepted', () => {
    const d = dialogs(true);
    const onDelete = jest.fn(); const onCancel = jest.fn();
    showWebAlert('Delete Folder', 'Are you sure?', [{ text: 'Cancel', style: 'cancel', onPress: onCancel }, { text: 'Delete', style: 'destructive', onPress: onDelete }], d);
    expect(d.confirm).toHaveBeenCalledWith('Delete Folder\n\nAre you sure?');
    expect(onDelete).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs Cancel (and not the action) when the confirm dialog is dismissed', () => {
    const d = dialogs(false);
    const onDelete = jest.fn(); const onCancel = jest.fn();
    showWebAlert('Delete', null, [{ text: 'Cancel', style: 'cancel', onPress: onCancel }, { text: 'Delete', onPress: onDelete }], d);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('page titles', () => {
  it('gives every page a unique, descriptive title and a description', () => {
    const titles = Object.entries(PAGE_META)
      .filter(([key]) => key !== 'Lecturer') // tab alias of LecturerDashboard
      .map(([key]) => formatTitle(key));
    expect(new Set(titles).size).toBe(titles.length);
    titles.forEach((t) => expect(t).toMatch(/^.+ \| CompuClass$/));
    Object.values(PAGE_META).forEach((p) => expect(p.description.length).toBeGreaterThan(40));
  });

  it('covers every screen registered in App.js', () => {
    const app = require('fs').readFileSync(require.resolve('../../App.js'), 'utf8');
    const routes = [...app.matchAll(/<(?:Tab|Stack)\.Screen name="([^"]+)"/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(20);
    routes.forEach((r) => expect(PAGE_META).toHaveProperty([r]));
  });
});

describe('sidebar width', () => {
  it('is 78% of a phone screen and capped on wide screens', () => {
    expect(getSidebarWidth(375)).toBeCloseTo(292.5);
    expect(getSidebarWidth(1440)).toBe(360);
    expect(getSidebarHiddenX(1440)).toBe(-384);
  });
});

describe('openRemoteDocument', () => {
  it.each(['javascript:alert(document.cookie)', 'data:text/html,<script>1</script>', 'http://insecure.example/file.pdf', '', null])(
    'refuses unsafe document URL %p',
    async (url) => {
      const { openRemoteDocument } = require('../fileDownload');
      const FileSystem = require('expo-file-system/legacy');
      await expect(openRemoteDocument(url, 'x.pdf')).rejects.toThrow('This document link is not valid.');
      expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
    }
  );

  it('downloads https documents to a sanitised path on native', async () => {
    const { openRemoteDocument } = require('../fileDownload');
    const FileSystem = require('expo-file-system/legacy');
    FileSystem.downloadAsync.mockResolvedValue({ status: 200, uri: 'file:///docs/notes.pdf' });
    await expect(openRemoteDocument('https://proj.supabase.co/storage/v1/object/public/documents/a.pdf', '../../notes.pdf')).resolves.toBe('downloaded');
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(expect.any(String), 'file:///docs/notes.pdf');
  });
});
