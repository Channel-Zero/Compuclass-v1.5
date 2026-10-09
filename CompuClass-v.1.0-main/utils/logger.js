const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  originalConsoleLog(...args);
};

console.error = (...args) => {
  originalConsoleError('[ERROR]', ...args);
};

console.warn = (...args) => {
  originalConsoleWarn('[WARN]', ...args);
};

if (typeof ErrorUtils !== 'undefined') {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('🚨 GLOBAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

export default {};
