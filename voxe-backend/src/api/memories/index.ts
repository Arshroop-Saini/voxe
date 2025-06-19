import express from 'express';
import { getMemories, createMemory, updateMemory, deleteMemory } from './memories.js';

const router = express.Router();

// GET /api/memories - Get all memories for a user
router.get('/', getMemories);

// POST /api/memories - Create a new memory
router.post('/', createMemory);

// PUT /api/memories/:id - Update a memory
router.put('/:id', updateMemory);

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', deleteMemory);

export default router; 