import { ChatBot } from "../siliconFlow/chatBot"

export type ChatBotTable = {
    guildId: string
    history: Message[]
    temperature?: number
    bot?: ChatBot
}

export type ChatBotResponseMessage = {
    commonResponse: string
    jsonResponse?: string
    useInfo?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
}