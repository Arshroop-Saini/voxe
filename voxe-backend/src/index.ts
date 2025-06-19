import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRouter from './api/auth/index.js';
import aiRouter from './api/ai/index.js';
import composioOAuthRouter from './api/composio/oauth.js';
import composioWebhookRouter from './api/composio/webhook.js';
import composioTriggersRouter from './api/composio/triggers.js';
import chatRouter from './api/chat/index.js';
import memoriesRouter from './api/memories/index.js';
import elevenLabsRouter from './api/elevenlabs-webhook.js';
import elevenLabsPostCallRouter from './api/elevenlabs-post-call-webhook.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  credentials: true
}));

// Raw body capture for ElevenLabs post-call webhook signature verification
app.use('/api/elevenlabs-post-call-webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/composio/oauth', composioOAuthRouter);
app.use('/api/composio/webhook', composioWebhookRouter);
app.use('/api/composio/triggers', composioTriggersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/memories', memoriesRouter);

// ElevenLabs webhooks
app.use('/api/elevenlabs-webhook', elevenLabsRouter);
app.use('/api/elevenlabs-post-call-webhook', elevenLabsPostCallRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Voxe backend is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Voxe backend server running on port ${PORT}`);
  console.log(`🎤 Voice processing endpoints available at /api/voice`);
  console.log(`💬 Chat API endpoints available at /api/chat`);
}); 