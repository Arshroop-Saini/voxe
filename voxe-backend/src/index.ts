import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRouter from './api/auth/index.js';
import voiceRouter from './api/voice/index.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/voice', voiceRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Voxe backend is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Voxe backend server running on port ${PORT}`);
  console.log(`🎤 Voice processing endpoints available at /api/voice`);
}); 