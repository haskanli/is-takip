const serializeError = (error) => ({
  name: error?.name,
  message: error?.message || String(error),
  status: error?.status,
  code: error?.code,
});

const write = (level, event, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };

  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](JSON.stringify(entry));
};

export const logger = {
  info: (event, details) => write("info", event, details),
  warn: (event, details) => write("warn", event, details),
  error: (event, error, details = {}) =>
    write("error", event, { ...details, error: serializeError(error) }),
};
