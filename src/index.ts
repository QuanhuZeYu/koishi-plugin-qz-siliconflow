import { Context, Schema } from 'koishi'

export const name = 'qz-siliconflow'

export interface Config { }

export const Config: Schema<Config> = Schema.object({
    baseConfig: Schema.object({
        apiKey: Schema.string().description('api密钥').required().role('secret'),
        model: Schema.union([])
            .description('选择模型（保存 API Key 后需要重新打开本配置页面刷新列表）')
            .required()
            .role('select', {
                async load(_, config) {
                    const ctx = this.ctx as Context
                    if (!config.apiKey) return [] // 密钥为空时直接返回
                    try {
                        const response = await fetchModels(ctx, config.apiKey)
                        return response.data.map(model => ({
                            label: model.id,
                            value: model.id
                        }))
                    } catch (error) {
                        ctx.logger('siliconflow').warn('模型加载失败:', error)
                        return []
                    }
                }
            })
    }),
    detail: Schema.object({
        maxToken: Schema.number().description('生成最大token数量').default(20480),
        frequency: Schema.number().description('重复惩罚 [0~1]').default(0.5),
        n: Schema.number().description('').default(1),
        responseFormat: Schema.string().description('返回格式').default(''),
        temperature: Schema.number().description('').default(0.7),
        topP: Schema.number().description('参数用于根据累积概率动态调整每个预测标记的选择数量').default(0.7),
        topK: Schema.number().description('').default(50),
    })
})

// 实现 API 请求
async function fetchModels(ctx: Context, apiKey: string) {
    const response = await ctx.http.get<ModelResponse>('https://api.siliconflow.cn/v1/models', {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    })
    return response
}

export function apply(ctx: Context) {
    // write your plugin here
}
