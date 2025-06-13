import express from 'express';
import googleRouter from './google.js';
import notionRouter from './notion.js';

const oauthRouter = express.Router();

// Mount OAuth routes
oauthRouter.use('/google', googleRouter);
oauthRouter.use('/notion', notionRouter);

export default oauthRouter; 