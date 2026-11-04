import React from 'react';
import { BackHandler, Modal, Platform, Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Sidebar, { readSidebarCollapsed, useSidebarCollapsed, writeSidebarCollapsed } from '../Sidebar';

jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

function StoredMenu() {
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  return (
    <Pressable accessibilityLabel="toggle stored menu" onPress={toggleCollapsed}>
      <Text>{collapsed ? 'stored-collapsed' : 'stored-open'}</Text>
    </Pressable>
  );
}

describe('Sidebar', () => {
  it('renders nothing when not visible', () => {
    const { toJSON } = render(<Sidebar visible={false} onClose={jest.fn()} onNavigate={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders every menu item when visible', () => {
    const { getByText } = render(<Sidebar visible onClose={jest.fn()} onNavigate={jest.fn()} />);

    ['Learning materials', 'PC Lab', 'Windows 11', 'Quizzes', 'Troubleshooting', 'CompuBot', 'CompuRunner', 'Settings'].forEach(
      (label) => expect(getByText(label)).toBeTruthy()
    );
  });

  it('navigates to the matching screen and closes when a menu item is pressed', () => {
    const onNavigate = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(<Sidebar visible onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.press(getByText('PC Lab'));

    expect(onNavigate).toHaveBeenCalledWith('PC Lab');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the lecturer quizzes page for a lecturer and the assigned list for a student', () => {
    const lecturerNavigate = jest.fn();
    const lecturer = render(
      <Sidebar visible onClose={jest.fn()} onNavigate={lecturerNavigate} user={{ profile: { role: 'lecturer' } }} />
    );
    fireEvent.press(lecturer.getByText('Quizzes'));
    expect(lecturerNavigate).toHaveBeenCalledWith({ screen: 'Lecturer', params: { screen: 'QuizCreation' } });

    const studentNavigate = jest.fn();
    const student = render(
      <Sidebar visible onClose={jest.fn()} onNavigate={studentNavigate} user={{ profile: { role: 'student' } }} />
    );
    fireEvent.press(student.getByText('Quizzes'));
    expect(studentNavigate).toHaveBeenCalledWith('Quiz');
  });

  it('marks the sidebar item for the screen that is open, including lecturer pages', () => {
    const { getByRole, rerender } = render(
      <Sidebar docked visible currentScreen="PC Lab" onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />
    );
    expect(getByRole('button', { name: 'PC Lab' }).props.accessibilityState).toMatchObject({ selected: true });

    rerender(<Sidebar docked visible currentScreen="FolderContent" onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />);
    expect(getByRole('button', { name: 'Home' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('keeps a closed phone menu out of the way, then shows it with the scrim', () => {
    const view = render(<Sidebar visible={false} retain onClose={jest.fn()} onNavigate={jest.fn()} />);
    expect(view.queryByLabelText('Close menu')).toBeNull();
    expect(view.queryByText('CompuRunner')).toBeNull();

    view.rerender(<Sidebar visible retain onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />);
    expect(view.getByLabelText('Close menu')).toBeTruthy();
    expect(view.getByTestId('drawer-backdrop')).toBeTruthy();
    expect(view.getByText('CompuRunner')).toBeTruthy();
  });

  it('shows the phone menu on Android above the screen, including collapse and games', () => {
    const previous = Platform.OS;
    Platform.OS = 'android';
    const onClose = jest.fn();
    try {
      const view = render(
        <Sidebar visible retain onClose={onClose} onToggleCollapsed={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />
      );
      expect(view.getByText('CompuRunner')).toBeTruthy();
      expect(view.getByLabelText('Collapse menu')).toBeTruthy();
      expect(view.getByTestId('drawer-backdrop')).toBeTruthy();
      view.UNSAFE_getByType(Modal).props.onRequestClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      Platform.OS = previous;
    }
  });

  it('highlights the open screen in the phone drawer and closes from the backdrop', () => {
    const onClose = jest.fn();
    const { getByRole, getByLabelText } = render(
      <Sidebar visible currentScreen="Settings" onClose={onClose} onNavigate={jest.fn()} onHomePress={jest.fn()} />
    );
    expect(getByRole('button', { name: 'Settings' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(getByRole('button', { name: 'Quizzes' }).props.accessibilityState).toMatchObject({ selected: false });

    fireEvent.press(getByLabelText('Close menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    const previous = global.window;
    const listeners = {};
    global.window = {
      addEventListener: (type, handler) => { listeners[type] = handler; },
      removeEventListener: jest.fn(),
    };
    const view = render(<Sidebar visible onClose={onClose} onNavigate={jest.fn()} />);
    const preventDefault = jest.fn();
    listeners.keydown({ key: 'Escape', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    global.window = previous;
  });

  it('closes on the hardware back button and does not trap back when docked', () => {
    const onClose = jest.fn();
    const handlers = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'hardwareBackPress') handlers.push(handler);
      return { remove: jest.fn() };
    });

    const phone = render(<Sidebar visible onClose={onClose} onNavigate={jest.fn()} />);
    expect(handlers[0]()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    phone.unmount();

    handlers.length = 0;
    render(<Sidebar docked visible currentScreen="Home" onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />);
    expect(handlers).toHaveLength(0);
    spy.mockRestore();
  });

  it('collapses to icon buttons and can expand again', () => {
    const onToggle = jest.fn();
    const view = render(
      <Sidebar docked collapsed onToggleCollapsed={onToggle} currentScreen="Materials" onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />
    );
    expect(view.queryByText('Learning materials')).toBeNull();
    expect(view.getByLabelText('Learning materials').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByLabelText('Learning materials').props.title).toBe('Learning materials');
    fireEvent.press(view.getByLabelText('Expand menu'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    view.rerender(
      <Sidebar docked collapsed={false} onToggleCollapsed={onToggle} currentScreen="Materials" onClose={jest.fn()} onNavigate={jest.fn()} onHomePress={jest.fn()} />
    );
    expect(view.getByText('Learning materials')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Collapse menu'));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('remembers the collapsed menu across sessions', async () => {
    await AsyncStorage.clear();
    await writeSidebarCollapsed(AsyncStorage, true);
    await expect(readSidebarCollapsed(AsyncStorage)).resolves.toBe(true);
    await writeSidebarCollapsed(AsyncStorage, false);
    await expect(readSidebarCollapsed(AsyncStorage)).resolves.toBe(false);

    const view = render(<StoredMenu />);
    await waitFor(() => expect(view.getByText('stored-open')).toBeTruthy());
    fireEvent.press(view.getByLabelText('toggle stored menu'));
    await waitFor(() => expect(view.getByText('stored-collapsed')).toBeTruthy());
    await expect(readSidebarCollapsed(AsyncStorage)).resolves.toBe(true);
  });
});
