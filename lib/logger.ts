type LogLevel = 'info' | 'warn' | 'error';

export const logger = {
  log: (level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

    if (process.env.NODE_ENV === 'development') {
      console[level](formattedMessage, data || '');
    } else {
      // In production, we could send this to a table in Supabase or an external API
      // For now, we still log to console but in a structured way
      console[level](JSON.stringify({
        timestamp,
        level,
        message,
        data,
      }));
    }
  },
  info: (message: string, data?: any) => logger.log('info', message, data),
  warn: (message: string, data?: any) => logger.log('warn', message, data),
  error: (message: string, data?: any) => logger.log('error', message, data),
};
