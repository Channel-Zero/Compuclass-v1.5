jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// CI runs Node 20, which has no global WebSocket. @supabase/realtime-js looks
// one up as soon as createClient() runs. Browsers and React Native already
// provide WebSocket; this stub only fills the gap for the test runtime.
if (typeof global.WebSocket === 'undefined') {
  class WebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = WebSocket.CONNECTING;
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }
  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;
  global.WebSocket = WebSocket;
}

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const iconStub = (props) => require('react').createElement(Text, props, props.name);
  return new Proxy({}, { get: () => iconStub });
});
