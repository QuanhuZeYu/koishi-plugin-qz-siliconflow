import { ChatBot } from "../siliconFlow/chatBot"

export interface ChatBotTable {
    guildId: string
    history: Message[]
    temperature?: number
    bot?: ChatBot
}

export interface ChatBotResponseMessage {
    commonResponse: string
    jsonResponse?: string
}