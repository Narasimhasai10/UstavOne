import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  transport: config.nodeEnv !== 'production' && config.nodeEnv !== 'test'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined
});
