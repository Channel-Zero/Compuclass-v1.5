import { Alert, Platform } from 'react-native';

// react-native-web implements Alert.alert as an empty function, so on the web
// build every success/error message was silently dropped and every confirm
// dialog's buttons (Delete, Logout, sign-up's "OK") never ran. This maps
// Alert.alert onto the browser's own dialogs. Native platforms are untouched.

export function showWebAlert(title, message, buttons, { alert = (t) => window.alert(t), confirm = (t) => window.confirm(t) } = {}) {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];

  if (list.length <= 1) {
    alert(text);
    list[0]?.onPress?.();
    return;
  }

  // Two or more buttons: OK runs the (last) non-cancel action, Cancel runs the cancel button.
  const cancelButton = list.find((b) => b.style === 'cancel');
  const actionButton = [...list].reverse().find((b) => b !== cancelButton);
  if (confirm(text)) actionButton?.onPress?.();
  else cancelButton?.onPress?.();
}

export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons) => showWebAlert(title, message, buttons);
}
