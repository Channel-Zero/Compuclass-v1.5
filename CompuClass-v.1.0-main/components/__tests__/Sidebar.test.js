import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  it('renders nothing when not visible', () => {
    const { toJSON } = render(<Sidebar visible={false} onClose={jest.fn()} onNavigate={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders every menu item when visible', () => {
    const { getByText } = render(<Sidebar visible onClose={jest.fn()} onNavigate={jest.fn()} />);

    ['Learning Materials', 'PC Lab', 'Windows 11', 'Quiz', 'Troubleshooting', 'Settings'].forEach(
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
});
