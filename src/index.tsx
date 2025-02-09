import { Context, Dict, h, Schema, segment, Session } from 'koishi'
import { ChatBot, chatBots } from './siliconFlow/chatBot'
import { ChatBotTable } from './interface/chatBotTable'
import { onMessageRecive } from './event/onMessageRecive'
import { ConfigService } from './service/ConfigService'
import { platform } from 'os'
import { TokenService } from './service/TokenService'
import { KoishiChat } from './service/KoishiChat'

export const inject = ['database'] // 添加这行声明依赖

declare module 'koishi' {
    interface Channel {
        chatbot: ChatBotTable
    }
    interface Context {
        qz_siliconflow_config: ConfigService
    }
}

export const name = 'qz-siliconflow'

export interface Config {
    select: {
        platform?: string
        apiEndpoint?: string
        apiKey?: string
        modelId?: string
    }
    baseConfig: {
        platform?: string
        apiEndpoint?: string
        apiKey?: string
        modelId?: string
    }[],
    detail: {
        systemPrompt?: string
        maxToken?: number
        frequency?: number
        n?: number
        responseFormat?: string
        temperature?: number
        topP?: number
        maxHistory?: number
        topK?: number
    },
    perGuildConfig: {
        guildId?: string
        systemPrompt?: string
    }[]
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        select: Schema.dynamic(ConfigService.SERVICE_NAME)
    }).description('选择器，选择你需要的平台模型'),
    Schema.object({
        baseConfig: Schema.array(Schema.object({
            platform: Schema.string().description('平台'),
            apiEndpoint: Schema.string().description('api地址'),
            apiKey: Schema.string().description('apiKey'),
            modelId: Schema.string().role(`select`).description('模型id'),
        }).description(`平台名称`)).role(`table`)
    }).description('基础配置列表'),
    Schema.object({
        detail: Schema.object({
            systemPrompt: Schema.string()
                .description('系统提示词，【】为替换符号')
                .default('接下来对话中的json文本均提取userContent为内容，userName是发送该消息的用户名。当前对话发生在群聊【guildId】。'), // 保持原默认值
            maxToken: Schema.number().description('生成最大 token 数量').default(2048),
            frequency: Schema.number().role('slider').min(0).max(1).default(0.5)
                .description('重复惩罚 [0~1]'),
            n: Schema.number().role('slider').min(1).max(5).default(1) // min 改为 1
                .description('生成结果数量'),
            responseFormat: Schema.string().description('返回格式').default(''),
            temperature: Schema.number().role('slider').min(0).max(1).default(0.7)
                .description('随机性 [0~1]'),
            topP: Schema.number().role('slider').min(0).max(1).default(0.7) // max 改为 1
                .description('动态概率阈值 [0~1]'),
            topK: Schema.number().role('slider').min(0).max(100).default(1)
                .description('候选标记数量'),
            maxHistory: Schema.number().description('历史记录条数').default(40),
        }),
    }).description('详细配置'),
    Schema.object({
        perGuildConfig: Schema.array(
            Schema.object({
                guildId: Schema.string().required().description('群组 ID'),
                name: Schema.string().description('备注名称'),
                systemPrompt: Schema.string().description('自定义系统提示词'),
            })
        ).collapse(true).role('table')
    }).description('按群组配置'),
])

export let data: {
    config?: Config
    ctx?: Context
} = {}

export async function apply(ctx: Context) {
    data.ctx = ctx
    data.config = ctx.config
    ctx.plugin(ConfigService)
    ctx.plugin(TokenService)

    KoishiChat.commandChat(ctx)
    KoishiChat.commandChatClear(ctx)
    KoishiChat.commandChatNH(ctx)
    KoishiChat.commandChatModelList(ctx)


    ctx.middleware(async (session, next) => {
        return onMessageRecive(session, next)
    })

    ctx.on('config', async () => {
        ConfigService.onConfigChange()
    });
}