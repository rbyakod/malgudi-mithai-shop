import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.nodeEnv === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.codeHash',
      '*.razorpayKeySecret',
      'env.RAZORPAY_KEY_SECRET',
      'env.MSG91_AUTH_KEY',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(name) {
      return { level: name };
    },
  },
  serializers: {
    req(req) {
      req.body = undefined;
      return req;
    },
  },
});

export type Logger = typeof logger;
