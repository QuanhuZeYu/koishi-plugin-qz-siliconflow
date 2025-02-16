import { Context, Dict, h, HTTP, Schema, segment, Session } from 'koishi'
import { ChatBotTable } from './interface/chatBotTable'
import { ConfigService } from './service/ConfigService'
import { TokenService } from './service/TokenService'
import { KoishiChat } from './service/KoishiChat'
import { } from "koishi-plugin-adapter-onebot"
import { select } from '@satorijs/element/jsx-runtime'
import { FavorableSystem } from './service/FavorableSystem'

export const inject = ['database'] // 添加这行声明依赖

declare module 'koishi' {
    interface Channel {
        chatbot: ChatBotTable
    }
    interface Context {
        qz_siliconflow_config: ConfigService
    }
    interface Tables {
        qz_siliconflow: qz_siliconflow
    }
}

export const name = 'qz-siliconflow'

export type select = {
    platform?: string
    apiEndpoint?: string
    apiKey?: string
    modelId?: string
}
export type Config = {
    select: select
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
        modelId?: string
    }[],
    pokeFavorable: {
        levels: {
            level?: number,
            prompt?: string
        }[],
        select?: select
        maxFavorable?: number
        systemPrompt?: string
    }
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
                .description('系统提示词，$为替换符号，目前支持 $guildId')
                .default('接下来对话中的json文本均提取userContent为内容，userName是发送该消息的用户名。当前对话发生在群聊$guilId。'), // 保持原默认值
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
                modelId: Schema.string().description('自定义模型'),
            })
        ).collapse(true).role('table')
    }).description('按群组配置'),
    Schema.object({
        pokeFavorable: Schema.object({
            levels: Schema.array(Schema.object({
                level: Schema.number().description(`好感等级`),
                prompt: Schema.string().description(`提示词`)
            })).description(`提示词用于指导大模型该好感等级应该回复什么`).role(`table`)
                .default([
                    { level: 0, prompt: `{'userName': '$userName', '好感度': $favorable}。用户 $userName 戳了一下你，请你以厌恶、生气、傲娇的语气回复一段话，例如"你很烦欸，别戳了"` },
                    { level: 50, prompt: `{'userName': '$userName', '好感度': $favorable}。用户 $userName 戳了一下你，请你以比较好的朋友、平和的语气回复一段话，例如"别戳了，休息一下吧"` },
                    { level: 100, prompt: `{'userName': '$userName', '好感度': $favorable}。用户 $userName 戳了一下你，请你以恋爱中、喜欢、热恋的语气回复一段话，例如"欸，有什么事吗"` },
                ]),
            select: Schema.dynamic(ConfigService.SERVICE_NAME),
            maxFavorable: Schema.number().description(`最大好感度`).default(200),
            systemPrompt: Schema.string().description(`好感系统提示词`)
                .default(`你当前在一个群聊，请你生成他人戳你一下的回复，长度不超过200字`)
        }).role(`table`),
    }).description(`好感系统`)
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
    ctx.plugin(FavorableSystem)

    KoishiChat.commandChat(ctx)
    KoishiChat.commandChatClear(ctx)
    KoishiChat.commandChatNH(ctx)
    KoishiChat.commandChatModelList(ctx)
    KoishiChat.collectMessage(ctx)

    KoishiChat.onPoke(ctx)


    ctx.on('config', async () => {
        await ConfigService.onConfigChange()
        ctx.inject([FavorableSystem.SERVICE_NAME], async ctx_ => {
            await ctx_?.qz_filiconflow_favorable_system?.configUpdate()
        })
    });
}


function printNestedObject(obj, maxDepth = 3) {
    const stringify = (value, currentDepth, indent) => {
        if (currentDepth > maxDepth) return '"..."';

        // 处理非对象类型
        if (typeof value !== 'object' || value === null) {
            return JSON.stringify(value);
        }

        // 处理数组
        if (Array.isArray(value)) {
            const items = value.map(item =>
                `${indent}  ${stringify(item, currentDepth + 1, indent + '  ')}`
            ).join(`,\n`);
            return `[\n${items}\n${indent}]`;
        }

        // 处理对象
        const entries = Object.entries(value).map(([key, val]) =>
            `${indent}  "${key}": ${stringify(val, currentDepth + 1, indent + '  ')}`
        ).join(`,\n`);

        return `{\n${entries}\n${indent}}`;
    };

    try {
        const result = stringify(obj, 1, '');
        console.log(result);
    } catch (error) {
        console.error('Error printing object:', error);
    }
}
