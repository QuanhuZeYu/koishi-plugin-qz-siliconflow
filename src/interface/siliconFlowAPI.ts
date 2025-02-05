// 定义消息类型
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    reasoning_content?: string;
}

// 定义 API 请求参数类型
interface ChatRequest {
    model: string;
    messages: Message[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}

// 定义 API 响应类型
interface ChatResponse {
    choices: {
        message: Message;
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

interface Model {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

interface ModelsResponse {
    data: Model[];
    object: string;
}