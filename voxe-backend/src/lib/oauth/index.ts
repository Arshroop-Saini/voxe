import express from 'express';
import notionRouter from './notion.js';

const oauthRouter = express.Router();

// Mount OAuth routes
oauthRouter.use('/notion', notionRouter);

export default oauthRouter; 