const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3002/api';

export interface TranscriptionResponse {
  success: boolean;
  transcription: string;
  confidence: number;
  duration: number;
  mock?: boolean;
  requestId?: string;
  processingTime?: number;
  language?: string;
  error?: string;
}

export interface TextProcessResponse {
  success: boolean;
  command: string;
  aiResponse?: {
    response: string;
    toolsUsed: string[];
    steps: number;
    memoryContext: boolean;
  };
  requestId?: string;
  error?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

class ApiService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message || error.error || 'API request failed');
    }

    return response.json();
  }

  async processText(text: string): Promise<TextProcessResponse> {
    // Get user ID for the request
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
    } catch (userError) {
      console.error('Failed to get user ID for text processing:', userError);
      throw new Error('User authentication required');
    }

    if (!userId) {
      throw new Error('Please sign in to use text processing features');
    }

    return this.request<TextProcessResponse>('/voice/process-text', {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({ text }),
    });
  }

  async processAudio(audioUri: string): Promise<TranscriptionResponse> {
    console.log('\n🌐 === API SERVICE: PROCESS AUDIO ===');
    console.log('📤 processAudio called with URI:', audioUri);
    
    // Get user ID for the request
    console.log('🔍 Getting user ID from Supabase...');
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
      console.log('✅ User ID retrieved:', userId ? `${userId.substring(0, 8)}...` : 'null');
    } catch (userError) {
      console.error('❌ Failed to get user ID:', userError);
      throw new Error('User authentication required for voice processing');
    }

    if (!userId) {
      console.error('❌ No user ID available');
      throw new Error('Please sign in to use voice features');
    }
    
    // Validate the audio URI
    if (!audioUri || typeof audioUri !== 'string') {
      console.error('❌ Invalid audio URI provided:', audioUri);
      throw new Error('Invalid audio URI provided');
    }
    
    console.log('🔍 Audio URI validation passed');
    
    const formData = new FormData();
    
    // For React Native, we need to handle the file URI correctly
    // The audioUri is a local file path from Expo AV recording
    // React Native FormData requires specific format for file uploads
    const audioFile = {
      uri: audioUri,
      type: 'audio/m4a', // Expo AV records in m4a format
      name: 'recording.m4a',
    };
    
    console.log('📁 Audio file object created:', {
      uri: audioFile.uri,
      type: audioFile.type,
      name: audioFile.name,
      uriType: typeof audioFile.uri,
      uriLength: audioFile.uri?.length || 0
    });
    
    try {
      // Check if we're in React Native or web environment
      const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
      const isExpoWeb = typeof window !== 'undefined' && window.location;
      
      console.log('🔍 Platform detection:', {
        isReactNative,
        isExpoWeb,
        platform: isReactNative ? 'React Native' : isExpoWeb ? 'Expo Web' : 'Unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
      });
      
      if (isReactNative) {
        // React Native native environment
        (formData as any).append('audio', audioFile);
        console.log('✅ Audio file appended to FormData (React Native native)');
      } else {
        // Web environment (Expo Web) - need to convert file URI to Blob
        console.log('🌐 Web environment detected, attempting to fetch file as Blob...');
        
        try {
          const response = await fetch(audioUri);
          const blob = await response.blob();
          
          console.log('📁 File converted to Blob:', {
            size: blob.size,
            type: blob.type,
            blobConstructor: blob.constructor.name
          });
          
          formData.append('audio', blob, 'recording.m4a');
          console.log('✅ Audio blob appended to FormData (Web)');
        } catch (blobError) {
          console.error('❌ Failed to convert file to blob:', blobError);
          throw new Error('Failed to convert audio file for web upload');
        }
      }
      
      // Log FormData contents for debugging
      console.log('🔍 FormData debug info:', {
        hasAudio: formData.has ? formData.has('audio') : 'has() not available',
        formDataType: typeof formData,
        formDataConstructor: formData.constructor.name
      });
      
      // Additional debugging: try to inspect the FormData
      try {
        if ((formData as any)._parts) {
          console.log('🔍 FormData._parts:', (formData as any)._parts);
        }
      } catch (partsError) {
        console.log('⚠️ Could not inspect FormData._parts:', partsError);
      }
      
    } catch (appendError) {
      console.error('❌ Failed to append audio to FormData:', appendError);
      throw new Error('Failed to prepare audio for upload');
    }

    // Use fetch directly for file uploads (don't use the request helper)
    const url = `${API_BASE_URL}/voice/process-audio`;
    console.log('🌐 Target URL:', url);
    console.log('📤 Sending HTTP POST request with user ID:', userId ? `${userId.substring(0, 8)}...` : 'null');
    
    const requestStartTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      // Don't set Content-Type header - let fetch set it automatically for FormData
      body: formData,
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log('📡 HTTP Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      requestDuration: `${requestDuration}ms`
    });
    
    if (!response.ok) {
      console.log('❌ HTTP request failed, parsing error response...');
      const error: ApiError = await response.json();
      console.error('💥 API error response:', {
        error: error.error,
        message: error.message,
        details: error.details,
        status: response.status
      });
      throw new Error(error.message || error.error || 'API request failed');
    }

    console.log('✅ HTTP request successful, parsing JSON response...');
    const result = await response.json();
    
    console.log('🎯 API success response:', {
      success: result.success,
      transcription: `"${result.transcription}"`,
      transcriptionLength: result.transcription?.length || 0,
      confidence: result.confidence,
      duration: result.duration,
      mock: result.mock || false,
      requestId: result.requestId || 'unknown',
      processingTime: result.processingTime || 'unknown',
      language: result.language || 'unknown',
      totalRequestTime: `${requestDuration}ms`
    });
    
    console.log('✅ === API SERVICE: PROCESS AUDIO COMPLETED ===\n');
    return result;
  }

  async processVoiceInput(formData: FormData): Promise<{
    transcription?: string;
    aiResponse?: string;
    success: boolean;
    error?: string;
  }> {
    // Get user ID for the request
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
    } catch (userError) {
      console.error('Failed to get user ID for voice processing:', userError);
      throw new Error('User authentication required');
    }

    if (!userId) {
      throw new Error('Please sign in to use voice features');
    }

    // Use fetch directly for file uploads
    const url = `${API_BASE_URL}/voice/process-input`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Voice processing failed');
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.request('/voice/health');
  }
}

export const apiService = new ApiService(); 