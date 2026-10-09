import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import JoinClassScreen from '../JoinClassScreen';
import { supabase } from '../../config/supabase';
import { limiters } from '../../utils/rateLimiter';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'student-1' } } })) },
    from: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

const rows = { current: [] };

const nav = () => ({ goBack: jest.fn() });

describe('JoinClassScreen', () => {
  jest.setTimeout(15000);

  beforeEach(async () => {
    rows.current = [];
    supabase.rpc.mockReset();
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: async () => ({ data: rows.current, error: null }),
      }),
    }));
    await limiters.classJoin.reset('device');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads enrolled classes when the screen is focused', async () => {
    rows.current = [{ class_id: 'c1', classes: { name: 'Morning Lab' } }];
    const { getByText } = render(<JoinClassScreen navigation={nav()} />);
    await waitFor(() => expect(getByText('Morning Lab')).toBeTruthy());
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects a code that is not 6 valid characters and does not call the database', async () => {
    const { getByLabelText, getByText } = render(<JoinClassScreen navigation={nav()} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    fireEvent.changeText(getByLabelText('Class code'), 'IO01');
    fireEvent.press(getByText('Join class'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Join a class', expect.stringMatching(/6 letters/)));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('shows the joined class and refreshes the list', async () => {
    supabase.rpc.mockResolvedValue({ data: { class_id: 'c1', name: 'Hardware Lab' }, error: null });
    const { getByLabelText, getByText } = render(<JoinClassScreen navigation={nav()} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    const loadsBeforeJoin = supabase.from.mock.calls.length;

    rows.current = [{ class_id: 'c1', classes: { name: 'Hardware Lab' } }];
    fireEvent.changeText(getByLabelText('Class code'), 'ab 23cd');
    fireEvent.press(getByText('Join class'));

    await waitFor(() => expect(getByText('You joined Hardware Lab.')).toBeTruthy());
    expect(supabase.rpc).toHaveBeenCalledWith('join_class_by_code', { p_code: 'AB23CD' });
    await waitFor(() => expect(getByText('Hardware Lab')).toBeTruthy());
    expect(supabase.from.mock.calls.length).toBeGreaterThan(loadsBeforeJoin);
  });

  it('shows Class code not found and does not claim a join', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Class code not found' } });
    const { getByLabelText, getByText, queryByText } = render(<JoinClassScreen navigation={nav()} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    fireEvent.changeText(getByLabelText('Class code'), 'AB23CD');
    fireEvent.press(getByText('Join class'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Join a class', 'Class code not found'));
    expect(queryByText(/You joined/)).toBeNull();
  });
});
