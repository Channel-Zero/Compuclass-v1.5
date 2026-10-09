import AsyncStorage from '@react-native-async-storage/async-storage';

// Progress and chat that belong to one signed-in person. Global preferences
// such as notifications and soundEffects are not in this list.
export const PER_USER_STORAGE_KEYS = [
  'compubot_chat_history',
  'circuitMazeProgress:v1',
  'compurunner_highscore',
];

export async function clearPerUserLocalData() {
  await AsyncStorage.multiRemove(PER_USER_STORAGE_KEYS);
}
