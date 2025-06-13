import express, { Request, Response } from 'express';
import oauthRouter from '../../lib/oauth/index.js';

const authRouter = express.Router();

// Mount OAuth routes
authRouter.use('/oauth', oauthRouter);

// Health check route
authRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Auth service is running' });
});

export default authRouter; 