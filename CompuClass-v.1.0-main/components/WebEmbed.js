import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// react-native-webview has no web implementation: on the web build it only
// renders "React Native WebView does not support this platform." This keeps the
// native WebView on iOS/Android and uses an iframe on web (same approach as the
// Windows 11 simulator screen).
export default function WebEmbed(props) {
  if (Platform.OS !== 'web') return <WebView {...props} />;

  const { source, style, title = 'Embedded 3D model' } = props;
  return (
    <View style={[styles.fill, style]}>
      <iframe
        title={title}
        src={source?.uri}
        srcDoc={source?.html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
        allowFullScreen
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
