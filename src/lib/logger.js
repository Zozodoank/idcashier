const isProduction = import.meta.env.PROD;

const logger = {
  log: (...args) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // We always want to see errors, even in production
    // You might want to send this to an error tracking service too
    console.error(...args);
  },
  info: (...args) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  debug: (...args) => {
    if (!isProduction) {
      console.debug(...args);
    }
  }
};

export default logger;
