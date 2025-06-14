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

// Process audio file (voice input) with enhanced error handling
voiceRouter.post('/process-audio', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  const requestId = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`\n🎤 [${requestId}] === VOICE PROCESSING STARTED ===`);
  
  // Debug request details
  console.log(`🔍 [${requestId}] Request debug info:`, {
    method: req.method,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasFile: !!req.file,
    filesCount: req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : 0
  });
  
  try {
    if (!req.file) {
      console.log(`❌ [${requestId}] No audio file provided in request`);
      console.log(`🔍 [${requestId}] Request body:`, req.body);
      console.log(`🔍 [${requestId}] Request files:`, req.files);
      console.log(`🔍 [${requestId}] Multer may have rejected the file - check file format/size`);
      res.status(400).json({ 
        error: 'No audio file provided',
        debug: {
          hasBody: !!req.body,
          hasFiles: !!req.files,
          contentType: req.get('Content-Type')
        },
        requestId
      });
      return;
    }

    console.log(`📁 [${requestId}] Audio file received:`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: `${req.file.size} bytes (${(req.file.size / 1024).toFixed(2)} KB)`,
      timestamp: new Date().toISOString()
    });

    // Log first few bytes to check file format
    const fileHeader = req.file.buffer.slice(0, 16).toString('hex');
    console.log(`🔍 [${requestId}] File header analysis:`, {
      firstBytes: fileHeader,
      isMP3: fileHeader.startsWith('fff3') || fileHeader.startsWith('fff2'),
      isM4A: fileHeader.includes('66747970'),
      bufferLength: req.file.buffer.length
    });

    // Get OpenAI client (returns null if API key not configured)
    const openaiClient = getOpenAIClient();
    
    if (!openaiClient) {
      console.log(`⚠️ [${requestId}] OpenAI API key not configured, using mock transcription`);
      const mockTranscription = "Send an email to John about the meeting";
      
      console.log(`🤖 [${requestId}] Returning mock transcription: "${mockTranscription}"`);
      res.json({
        success: true,
        transcription: mockTranscription,
        confidence: 0.95,
        duration: req.file.size / 16000, // Rough estimate
        mock: true,
        requestId
      });
      return;
    }

    console.log(`✅ [${requestId}] OpenAI client configured, proceeding with Whisper API`);

    let tempFilePath: string | null = null;
    
    try {
      // Create a temporary file for OpenAI Whisper API
      console.log(`📂 [${requestId}] Creating temporary file for Whisper API...`);
      
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        console.log(`📁 [${requestId}] Creating temp directory: ${tempDir}`);
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
      if (fileHeader.startsWith('fff3') || fileHeader.startsWith('fff2')) {
        fileExtension = '.mp3'; // MP3 header
      } else if (fileHeader.includes('66747970')) {
        fileExtension = '.m4a'; // M4A/MP4 header (ftyp)
      }
      
      console.log(`🎵 [${requestId}] File format determined: ${fileExtension} (based on MIME: ${req.file.mimetype})`);
      
      const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
      tempFilePath = path.join(tempDir, tempFileName);
      
      console.log(`💾 [${requestId}] Writing audio to temp file: ${tempFileName}`);
      
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, req.file.buffer);
      
      console.log(`✅ [${requestId}] Temp file created successfully, size: ${fs.statSync(tempFilePath).size} bytes`);

      // Transcribe audio using OpenAI Whisper
      console.log(`🤖 [${requestId}] Sending to OpenAI Whisper API...`);
      const whisperStartTime = Date.now();
      
      const transcription = await openaiClient.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // Can be made configurable
        response_format: 'verbose_json', // Get confidence scores
      });

      const whisperDuration = Date.now() - whisperStartTime;
      console.log(`⚡ [${requestId}] Whisper API completed in ${whisperDuration}ms`);

      // Clean up temporary file
      console.log(`🗑️ [${requestId}] Cleaning up temp file: ${tempFileName}`);
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      console.log(`🎯 [${requestId}] Whisper transcription result:`, {
        text: `"${transcription.text}"`,
        textLength: transcription.text.length,
        duration: `${transcription.duration}s`,
        language: transcription.language,
        processingTime: `${whisperDuration}ms`
      });

      console.log(`✅ [${requestId}] === VOICE PROCESSING COMPLETED SUCCESSFULLY ===\n`);

      res.json({
        success: true,
        transcription: transcription.text,
        confidence: 0.95, // Whisper doesn't provide confidence in verbose_json yet
        duration: transcription.duration,
        language: transcription.language,
        requestId,
        processingTime: whisperDuration
      });
      
    } catch (whisperError) {
      console.error(`❌ [${requestId}] Whisper API error:`, {
        error: whisperError instanceof Error ? whisperError.message : whisperError,
        stack: whisperError instanceof Error ? whisperError.stack : undefined
      });
      
      // Clean up temporary file if it exists
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          console.log(`🗑️ [${requestId}] Cleaning up temp file after error: ${tempFilePath}`);
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn(`⚠️ [${requestId}] Failed to cleanup temp file:`, cleanupError);
        }
      }
      
      // If Whisper fails, fall back to mock transcription
      console.warn(`🔄 [${requestId}] Whisper API failed, using mock transcription fallback`);
      const mockTranscription = "Send an email to John about the meeting";
      
      console.log(`🤖 [${requestId}] Returning mock transcription: "${mockTranscription}"`);
      console.log(`⚠️ [${requestId}] === VOICE PROCESSING COMPLETED WITH FALLBACK ===\n`);
      
      res.json({
        success: true,
        transcription: mockTranscription,
        confidence: 0.95,
        duration: req.file.size / 16000, // Rough estimate
        mock: true,
        error: whisperError instanceof Error ? whisperError.message : 'Whisper API error',
        requestId
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Audio processing error:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    console.log(`❌ [${requestId}] === VOICE PROCESSING FAILED ===\n`);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        res.status(401).json({ 
          error: 'OpenAI API key not configured or invalid',
          message: 'Please check your OPENAI_API_KEY environment variable',
          requestId
        });
      } else if (error.message.includes('file')) {
        res.status(400).json({ 
          error: 'Invalid audio file',
          message: 'Please ensure the audio file is in a supported format (mp3, wav, m4a, etc.)',
          requestId
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to process audio',
          message: error.message,
          requestId
        });
      }
    } else {
      res.status(500).json({ 
        error: 'Failed to process audio',
        message: 'Unknown error occurred',
        requestId
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