import { WebView } from 'react-native-webview';

export default function WebFrame({ src, onLoad, style }) {
  return (
    <WebView
      source={{ uri: src }}
      style={style}
      onLoadEnd={onLoad}
    />
  );
}
