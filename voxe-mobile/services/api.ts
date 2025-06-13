const API_BASE_URL = 'http://localhost:3002/api';

export interface TranscriptionResponse {
  success: boolean;
  transcription: string;
  confidence: number;
  duration: number;
}

export interface TextProcessResponse {
  success: boolean;
  command: string;
  intent: string;
  parameters: Record<string, any>;
  confidence: number;
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
    return this.request<TextProcessResponse>('/voice/process-text', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async processAudio(audioUri: string): Promise<TranscriptionResponse> {
    console.log('processAudio called with URI:', audioUri);
    
    const formData = new FormData();
    
    // For React Native, we need to handle the file URI correctly
    // The audioUri is a local file path from Expo AV recording
    const audioFile = {
      uri: audioUri,
      type: 'audio/m4a', // Expo AV records in m4a format
      name: 'recording.m4a',
    };
    
    console.log('Audio file object:', audioFile);
    formData.append('audio', audioFile as any);

    // Use fetch directly for file uploads (don't use the request helper)
    const url = `${API_BASE_URL}/voice/process-audio`;
    console.log('Sending request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      // Don't set Content-Type header - let fetch set it automatically for FormData
      body: formData,
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const error: ApiError = await response.json();
      console.error('API error response:', error);
      throw new Error(error.message || error.error || 'API request failed');
    }

    const result = await response.json();
    console.log('API success response:', result);
    return result;
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.request('/voice/health');
  }
}

export const apiService = new ApiService(); 