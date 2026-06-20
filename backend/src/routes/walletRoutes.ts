import { Router } from 'express';
import {
  getBalance,
  transferFunds,
  deposit,
  getTransactionHistory,
} from '../controllers/walletController';
import { authenticate } from '../middleware/authMiddleware';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware';
import { transferRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Every route in this router requires a valid access token.
router.use(authenticate);

router.get('/balance', getBalance);
router.get('/transactions', getTransactionHistory);
router.post('/deposit', deposit);

// The transfer endpoint stacks THREE layers of protection in order:
//   1. authenticate          -> who is making this request?
//   2. transferRateLimiter   -> are they making too many requests too fast?
//   3. idempotencyMiddleware -> have they already submitted this exact
//                                operation (via Idempotency-Key header)?
// Only after all three pass does the request reach the controller.
router.post('/transfer', transferRateLimiter, idempotencyMiddleware, transferFunds);

export default router;
