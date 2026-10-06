import { unstable_createElement } from 'react-native-web';

export default function WebFrame({ src, onLoad, style }) {
  return unstable_createElement('iframe', {
    src,
    onLoad,
    title: 'Windows 11 Simulator',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals',
    style: { border: 'none', width: '100%', height: '100%', ...(style || {}) },
  });
}
