import { createContext, useContext } from 'react';

// The signed-in shell draws one back button for non-root screens.
// Screens hide their own leave button while that shell button is showing.
const ChromeContext = createContext({ shellBack: false, setSimulatorFullscreen: () => {} });

export const ChromeProvider = ChromeContext.Provider;

export function useChrome() {
  return useContext(ChromeContext);
}

export function useShellBack() {
  return useChrome().shellBack;
}
