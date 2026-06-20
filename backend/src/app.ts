import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import authRoutes from './routes/authRoutes';
import walletRoutes from './routes/walletRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Security headers (sensible defaults: disables x-powered-by, sets
  // various anti-sniffing / clickjacking headers, etc.)
  app.use(helmet());

  // CORS: must allow credentials so the HttpOnly refresh-token cookie is
  // sent on cross-origin requests from the frontend dev server / SPA.
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);

  // Must be registered after all real routes.
  app.use(notFoundHandler);
  // Centralized error handler — must be the LAST middleware registered.
  app.use(errorHandler);

  return app;
}
