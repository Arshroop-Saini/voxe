import express, { Request, Response } from 'express';
import {
  createThread,
  listThreads,
  getThread,
  updateThread,
  deleteThread,
  healthCheck
} from './threads.js';
import {
  sendMessage,
  getMessages,
  healthCheck as messagesHealthCheck
} from './messages.js';

/**
 * Chat API Router
 * Handles all chat-related endpoints including threads and messages
 */
const chatRouter = express.Router();

// Health check
chatRouter.get('/health', async (req: Request, res: Response): Promise<void> => {
  await healthCheck(req, res);
});

// Thread management routes
chatRouter.post('/threads', async (req: Request, res: Response): Promise<void> => {
  await createThread(req, res);
});

chatRouter.get('/threads', async (req: Request, res: Response): Promise<void> => {
  await listThreads(req, res);
});

chatRouter.get('/threads/:id', async (req: Request, res: Response): Promise<void> => {
  await getThread(req, res);
});

chatRouter.put('/threads/:id', async (req: Request, res: Response): Promise<void> => {
  await updateThread(req, res);
});

chatRouter.delete('/threads/:id', async (req: Request, res: Response): Promise<void> => {
  await deleteThread(req, res);
});

// Message routes
chatRouter.post('/messages', async (req: Request, res: Response): Promise<void> => {
  await sendMessage(req, res);
});

chatRouter.get('/messages/:threadId', async (req: Request, res: Response): Promise<void> => {
  await getMessages(req, res);
});

chatRouter.get('/messages/health', async (req: Request, res: Response): Promise<void> => {
  await messagesHealthCheck(req, res);
});

export default chatRouter; 