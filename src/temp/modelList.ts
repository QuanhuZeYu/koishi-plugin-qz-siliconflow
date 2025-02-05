import { Context } from "koishi"

export class ModelManager {
    public cache: String[] = []
    public apiGetModels: string = 'https://api.siliconflow.cn/v1/models'
    private ctx: Context

    constructor(ctx: Context) {
        this.ctx = ctx
    }

    publicgetModels() {
        if (this.cache === null || this.cache.length === 0) {
            this.cache = [] // 重置为空数组
            this.refreshModels
        }
        while (this.cache.length === 0) {
            if (this.cache === null) { // 当cache为null时，可以确定获取失败
                this.cache = []
                return this.cache
            } else if (this.cache.length > 0) {
                return this.cache
            }
        }
    }

    async refreshModels() {
        try {
            const response = await this.ctx.http.get<ModelResponse>(
                this.apiGetModels,
                {
                    headers: {
                        Authorization: `Bearer ${this.ctx.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
            this.cache = response.data.map(m => m.id)
        } catch {
            this.ctx.logger.error('Failed to refresh models')
            this.cache = null
        }
    }
}