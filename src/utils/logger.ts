/**
 * Development-only logging utility
 * In production builds, debug logs become no-ops
 */

const IS_DEV = import.meta.env.DEV;

export const devLog = (...args: any[]) => {
  if (IS_DEV) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (IS_DEV) {
    console.warn(...args);
  }
};

// Always log errors (even in production)
export const logError = (...args: any[]) => {
  console.error(...args);
};
