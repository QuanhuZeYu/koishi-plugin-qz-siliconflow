// 定义消息类型
type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    reasoning_content?: string;
}

// 定义 API 请求参数类型
type ChatRequest = {
    model: string;
    messages: Message[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}

// 定义 API 响应类型
type ChatResponse = {
    choices: {
        message: Message;
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

type Model = {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

type ModelsResponse = {
    data: Model[];
    object: string;
}