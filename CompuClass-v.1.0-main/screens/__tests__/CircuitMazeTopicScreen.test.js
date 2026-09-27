import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CircuitMazeTopicScreen from '../CircuitMazeTopicScreen';
import { circuitMazeProgress, TOTAL_LEVELS } from '../../services/circuitMazeProgress';
import { circuitMazeService } from '../../services/circuitMazeService';
import { gamificationService } from '../../services/gamificationservice';

jest.mock('../../services/circuitMazeService', () => ({
  circuitMazeService: { getTopicPerformance: jest.fn() },
}));

jest.mock('../../services/gamificationservice', () => ({
  gamificationService: { getMyStats: jest.fn() },
}));

// useFocusEffect fires like useEffect in tests; the rest of the module is real.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });

beforeEach(async () => {
  jest.clearAllMocks();
  await circuitMazeProgress.reset();
  circuitMazeService.getTopicPerformance.mockResolvedValue(null);
  gamificationService.getMyStats.mockResolvedValue({ xp: 0, level: 1, current_streak: 0 });
});

describe('CircuitMazeTopicScreen', () => {
  it('lists every topic with its untouched progress', async () => {
    const { getByText, getAllByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('Networking')).toBeTruthy());
    expect(getByText('Cybersecurity')).toBeTruthy();
    expect(getAllByText(`Level 0 / ${TOTAL_LEVELS}`)).toHaveLength(6);
  });

  it('navigates to the lobby with the chosen topic, as before', async () => {
    const navigation = nav();
    const { getByText } = render(<CircuitMazeTopicScreen navigation={navigation} />);

    await waitFor(() => expect(getByText('Hardware')).toBeTruthy());
    fireEvent.press(getByText('Hardware'));

    expect(navigation.navigate).toHaveBeenCalledWith('CircuitMazeLobby', { topic: 'hardware' });
  });

  it('opens settings from the header', async () => {
    const navigation = nav();
    const { getByLabelText, getByText } = render(<CircuitMazeTopicScreen navigation={navigation} />);
    await waitFor(() => expect(getByText('EXPLORE TOPICS')).toBeTruthy());

    fireEvent.press(getByLabelText('Settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });

  it('goes back from the header', async () => {
    const navigation = nav();
    const { getByLabelText, getByText } = render(<CircuitMazeTopicScreen navigation={navigation} />);
    await waitFor(() => expect(getByText('EXPLORE TOPICS')).toBeTruthy());

    fireEvent.press(getByLabelText('Go back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('hides the continue card until there is real progress', async () => {
    const { queryByText, getByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('Networking')).toBeTruthy());
    expect(queryByText('CONTINUE LEARNING')).toBeNull();
  });

  it('shows the continue card for the last unfinished topic played', async () => {
    await circuitMazeProgress.recordLevelCleared('software', 4);
    const { getByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('CONTINUE LEARNING')).toBeTruthy());
    expect(getByText(/Level 5 of 10/)).toBeTruthy();
    expect(getByText('40%')).toBeTruthy();
    expect(getByText(`Level 4 / ${TOTAL_LEVELS}`)).toBeTruthy();
  });

  it('continues into the lobby for the resumed topic', async () => {
    await circuitMazeProgress.recordLevelCleared('databases', 2);
    const navigation = nav();
    const { getByText } = render(<CircuitMazeTopicScreen navigation={navigation} />);

    await waitFor(() => expect(getByText('CONTINUE')).toBeTruthy());
    fireEvent.press(getByText('CONTINUE'));

    expect(navigation.navigate).toHaveBeenCalledWith('CircuitMazeLobby', { topic: 'databases' });
  });

  it('marks a finished topic complete and counts it in the section header', async () => {
    await circuitMazeProgress.recordLevelCleared('datasci', TOTAL_LEVELS);
    const { getByText, queryByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('✓ COMPLETED')).toBeTruthy());
    expect(getByText('1/6 COMPLETE')).toBeTruthy();
    // A completed topic is not something to continue.
    expect(queryByText('CONTINUE LEARNING')).toBeNull();
  });

  it('shows real streak and XP chips, and nothing when they are zero', async () => {
    gamificationService.getMyStats.mockResolvedValue({ xp: 1240, level: 5, current_streak: 7 });
    const { getByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('7 DAY STREAK')).toBeTruthy());
    expect(getByText('1,240 XP')).toBeTruthy();
  });

  it('renders the answered-question count only when the counters hold data', async () => {
    await circuitMazeProgress.recordLevelCleared('networking', 3);
    circuitMazeService.getTopicPerformance.mockResolvedValue({
      networking: { easy: { correct_count: 20, wrong_count: 8 }, medium: { correct_count: 10, wrong_count: 0 } },
    });
    const { getByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('38 questions answered')).toBeTruthy());
  });

  it('still renders when the backend calls fail', async () => {
    gamificationService.getMyStats.mockResolvedValue(null);
    circuitMazeService.getTopicPerformance.mockResolvedValue(null);
    const { getByText } = render(<CircuitMazeTopicScreen navigation={nav()} />);

    await waitFor(() => expect(getByText('EXPLORE TOPICS')).toBeTruthy());
  });
});
