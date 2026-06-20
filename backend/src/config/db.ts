import mongoose from 'mongoose';
import { env } from './env';

/**
 * Establishes a connection to MongoDB using Mongoose.
 * Exits the process on failure since the app cannot function without a DB.
 */
export const connectDB = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(env.MONGO_URI);

    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection lost. Attempting to reconnect is handled by the driver.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
    });
  } catch (error) {
    console.error('[MongoDB] Initial connection failed:', error);
    process.exit(1);
  }
};

/**
 * Gracefully closes the MongoDB connection. Used during process shutdown.
 */
export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log('[MongoDB] Connection closed gracefully.');
};
