import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CLIENT_ORIGIN: string;
  MONGO_URI: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string | undefined;
  USE_IN_MEMORY_CACHE: boolean;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
}

/**
 * Reads an environment variable and throws a descriptive startup error
 * if it is required but missing. Fails fast rather than letting the app
 * boot into an invalid, hard-to-debug state.
 */
function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

export const env: EnvConfig = {
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  PORT: Number(getEnvVar('PORT', '5000')),
  CLIENT_ORIGIN: getEnvVar('CLIENT_ORIGIN', 'http://localhost:5173'),
  MONGO_URI: getEnvVar('MONGO_URI', 'mongodb://localhost:27017/fintech_wallet'),
  REDIS_HOST: getEnvVar('REDIS_HOST', '127.0.0.1'),
  REDIS_PORT: Number(getEnvVar('REDIS_PORT', '6379')),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  USE_IN_MEMORY_CACHE: (process.env.USE_IN_MEMORY_CACHE ?? 'true').toLowerCase() === 'true',
  ACCESS_TOKEN_SECRET: getEnvVar('ACCESS_TOKEN_SECRET'),
  REFRESH_TOKEN_SECRET: getEnvVar('REFRESH_TOKEN_SECRET'),
  ACCESS_TOKEN_EXPIRY: getEnvVar('ACCESS_TOKEN_EXPIRY', '15m'),
  REFRESH_TOKEN_EXPIRY: getEnvVar('REFRESH_TOKEN_EXPIRY', '7d'),
};
