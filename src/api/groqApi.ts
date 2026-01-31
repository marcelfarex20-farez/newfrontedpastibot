import api from './axios';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    message: string;
    conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
    success: boolean;
    response?: string;
    error?: string;
}

/**
 * Envía un mensaje al asistente de IA
 * @param message - Mensaje del usuario
 * @param conversationHistory - Historial de conversación opcional
 * @returns Respuesta del asistente
 */
export const sendChatMessage = async (
    message: string,
    conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
    try {
        const response = await api.post<ChatResponse>('/groq/chat', {
            message,
            conversationHistory,
        });

        return response.data;
    } catch (error: any) {
        console.error('Error al enviar mensaje al asistente:', error);
        return {
            success: false,
            error: error.response?.data?.message || 'No se pudo conectar con el asistente de IA',
        };
    }
};
/**
 * Envía un archivo de audio para ser transcrito por Whisper
 * @param audioBlob - Blob con la grabación de audio
 * @returns Texto transcrito
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<{ success: boolean; text?: string; error?: string }> => {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await api.post<{ success: boolean; text?: string; error?: string }>('/groq/transcribe', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    } catch (error: any) {
        console.error('Error al transcribir audio:', error);
        return {
            success: false,
            error: error.response?.data?.message || 'No se pudo transcribir el audio',
        };
    }
};
