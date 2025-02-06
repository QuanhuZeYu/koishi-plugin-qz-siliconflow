import { ConfigT } from ".";

export class ConfigUtil {
    static getEndPoint(config: ConfigT) {
        return config.apiEndpoint?.[0]?.endpoint;
    }

    static getApiKey(config: ConfigT) {
        return config.apiEndpoint?.[0]?.apiKey;
    }

    static getModel(config: ConfigT) {
        return config.apiEndpoint?.[0]?.model?.[0]?.id;
    }
}