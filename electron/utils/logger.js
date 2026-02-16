/**
 * Development-only logging utility for Electron main process
 * In production builds, debug logs become no-ops
 */

const IS_DEV = process.env.NODE_ENV === 'development';

export const devLog = (...args) => {
  if (IS_DEV) {
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (IS_DEV) {
    console.warn(...args);
  }
};

// Always log errors (even in production)
export const logError = (...args) => {
  console.error(...args);
};
