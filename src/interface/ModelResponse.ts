
// 定义接口类型
interface ModelResponse {
    object: string
    data: Model[]
}

interface Model {
    id: string
    object: string
    created: number
    owned_by: string
}