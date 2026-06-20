import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { Wallet } from '../models/Wallet';
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from '../utils/AppError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../utils/validators';
import { SanitizedUser } from '../types';

function sanitizeUser(user: IUser): SanitizedUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: SanitizedUser;
  tokens: AuthTokens;
}

/**
 * Registers a new user AND provisions their wallet atomically.
 *
 * Why a transaction here too: a user must never exist without a wallet
 * (every future balance query / transfer assumes exactly one wallet per
 * user). Using a session ensures that if wallet creation fails for any
 * reason, the user document is rolled back as well — no orphaned users.
 */
async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const session = await mongoose.startSession();
  let createdUser: IUser | null = null;

  try {
    await session.withTransaction(async () => {
      const [user] = await User.create(
        [{ name: input.name, email: input.email, password: input.password }],
        { session }
      );

      await Wallet.create(
        [{ user: user._id, balance: 0, currency: 'USD', version: 0 }],
        { session }
      );

      createdUser = user;
    });
  } catch (error) {
    // Mongo's unique index on email is the final backstop against a race
    // where two registration requests for the same email pass the
    // findOne check concurrently.
    if (error instanceof Error && (error as { code?: number }).code === 11000) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw new InternalServerError('Failed to create account. Please try again.');
  } finally {
    await session.endSession();
  }

  if (!createdUser) {
    throw new InternalServerError('Failed to create account. Please try again.');
  }

  const tokens = issueTokenPair(createdUser);
  return { user: sanitizeUser(createdUser), tokens };
}

async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const tokens = issueTokenPair(user);
  return { user: sanitizeUser(user), tokens };
}

function issueTokenPair(user: IUser): AuthTokens {
  const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email });
  const refreshToken = signRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.refreshTokenVersion,
  });
  return { accessToken, refreshToken };
}

/**
 * Exchanges a valid refresh token (read from the HttpOnly cookie) for a
 * fresh access/refresh token pair. Validates the embedded tokenVersion
 * against the current value stored on the user — if they don't match,
 * the refresh token has been revoked (e.g. via logout-all-devices) and
 * the request is rejected even though the JWT signature itself is valid.
 */
async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(payload.userId);
  if (!user) {
    throw new UnauthorizedError('User no longer exists', 'INVALID_REFRESH_TOKEN');
  }

  if (user.refreshTokenVersion !== payload.tokenVersion) {
    throw new UnauthorizedError(
      'Refresh token has been revoked. Please log in again.',
      'REFRESH_TOKEN_REVOKED'
    );
  }

  return issueTokenPair(user);
}

/**
 * Invalidates ALL outstanding refresh tokens for a user by bumping the
 * stored token version. Any refresh token signed with the old version
 * will be rejected by refreshTokens() above, even if it has not expired.
 */
async function logout(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $inc: { refreshTokenVersion: 1 } });
}

async function getUserById(userId: string): Promise<SanitizedUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new BadRequestError('User not found', 'USER_NOT_FOUND');
  }
  return sanitizeUser(user);
}

export const authService = {
  register,
  login,
  refreshTokens,
  logout,
  getUserById,
};
