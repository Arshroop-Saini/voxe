import express, { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const voiceRouter = express.Router();

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  return openai;
}

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper API limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files by MIME type or file extension
    const allowedMimeTypes = [
      'audio/mpeg',     // MP3
      'audio/mp3',      // MP3 (alternative)
      'audio/wav',      // WAV
      'audio/wave',     // WAV (alternative)
      'audio/x-wav',    // WAV (alternative)
      'audio/mp4',      // M4A
      'audio/m4a',      // M4A
      'audio/x-m4a',    // M4A (alternative)
      'audio/aac',      // AAC
      'audio/ogg',      // OGG
      'audio/webm',     // WebM
      'audio/flac',     // FLAC
    ];
    
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];
    const fileExtension = file.originalname?.toLowerCase().match(/\.[^.]+$/)?.[0];
    
    if (allowedMimeTypes.includes(file.mimetype) || 
        (fileExtension && allowedExtensions.includes(fileExtension))) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format. Supported formats: ${allowedExtensions.join(', ')}`));
    }
  },
});

// Schema for text processing
const textProcessSchema = z.object({
  text: z.string().min(1).max(1000),
});

// Health check endpoint
voiceRouter.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'Voice processing service is running',
    timestamp: new Date().toISOString()
  });
});

// Process audio file (voice input)
voiceRouter.post('/process-audio', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    console.log('Audio file received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Log first few bytes to check file format
    console.log('File header (first 16 bytes):', req.file.buffer.slice(0, 16).toString('hex'));

    // Get OpenAI client (returns null if API key not configured)
    const openaiClient = getOpenAIClient();
    
    if (!openaiClient) {
      console.warn('OpenAI API key not configured, using mock transcription');
      const mockTranscription = "Send an email to John about the meeting";
      
      res.json({
        success: true,
        transcription: mockTranscription,
        confidence: 0.95,
        duration: req.file.size / 16000, // Rough estimate
        mock: true,
      });
      return;
    }

    let tempFilePath: string | null = null;
    
    try {
      // Create a temporary file for OpenAI Whisper API
      // OpenAI SDK works better with actual files in Node.js
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Determine the correct file extension based on MIME type and file content
      let fileExtension = '.m4a'; // Default
      
      if (req.file.mimetype.includes('mp3') || req.file.mimetype.includes('mpeg')) {
        fileExtension = '.mp3';
      } else if (req.file.mimetype.includes('wav')) {
        fileExtension = '.wav';
      } else if (req.file.mimetype.includes('m4a') || req.file.mimetype.includes('mp4')) {
        fileExtension = '.m4a';
      }
      
      // Check file header to confirm format
      const fileHeader = req.file.buffer.slice(0, 8).toString('hex');
      if (fileHeader.startsWith('fff3') || fileHeader.startsWith('fff2')) {
        fileExtension = '.mp3'; // MP3 header
      } else if (fileHeader.includes('66747970')) {
        fileExtension = '.m4a'; // M4A/MP4 header (ftyp)
      }
      
      console.log('Using file extension:', fileExtension);
      
      const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
      tempFilePath = path.join(tempDir, tempFileName);
      
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Transcribe audio using OpenAI Whisper
      const transcription = await openaiClient.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // Can be made configurable
        response_format: 'verbose_json', // Get confidence scores
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      console.log('Whisper transcription result:', {
        text: transcription.text,
        duration: transcription.duration,
      });

      res.json({
        success: true,
        transcription: transcription.text,
        confidence: 0.95, // Whisper doesn't provide confidence in verbose_json yet
        duration: transcription.duration,
        language: transcription.language,
      });
      
         } catch (whisperError) {
       console.error('Whisper API error:', whisperError);
       
       // Clean up temporary file if it exists
       if (tempFilePath && fs.existsSync(tempFilePath)) {
         try {
           fs.unlinkSync(tempFilePath);
         } catch (cleanupError) {
           console.warn('Failed to cleanup temp file:', cleanupError);
         }
       }
       
       // If Whisper fails, fall back to mock transcription
       console.warn('Whisper API failed, using mock transcription');
       const mockTranscription = "Send an email to John about the meeting";
       
       res.json({
         success: true,
         transcription: mockTranscription,
         confidence: 0.95,
         duration: req.file.size / 16000, // Rough estimate
         mock: true,
         error: whisperError instanceof Error ? whisperError.message : 'Whisper API error',
       });
     }

  } catch (error) {
    console.error('Audio processing error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        res.status(401).json({ 
          error: 'OpenAI API key not configured or invalid',
          message: 'Please check your OPENAI_API_KEY environment variable'
        });
      } else if (error.message.includes('file')) {
        res.status(400).json({ 
          error: 'Invalid audio file',
          message: 'Please ensure the audio file is in a supported format (mp3, wav, m4a, etc.)'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to process audio',
          message: error.message
        });
      }
    } else {
      res.status(500).json({ 
        error: 'Failed to process audio',
        message: 'Unknown error occurred'
      });
    }
  }
});

// Process text input
voiceRouter.post('/process-text', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = textProcessSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Invalid request body',
        details: result.error.errors
      });
      return;
    }

    const { text } = result.data;

    // TODO: Integrate with Vercel AI SDK and GPT-4o
    // For now, return a mock response
    console.log('Text received for processing:', text);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({
      success: true,
      command: text,
      intent: 'send_email',
      parameters: {
        recipient: 'john@example.com',
        subject: 'Meeting',
        body: 'About the meeting'
      },
      confidence: 0.92,
    });

  } catch (error) {
    console.error('Text processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default voiceRouter; 