# koishi-plugin-qz-siliconflow

[![npm](https://img.shields.io/npm/v/@quanhuzeyu/koishi-plugin-qz-siliconflow?style=flat-square)](https://www.npmjs.com/package/@quanhuzeyu/koishi-plugin-qz-siliconflow)

## 功能概述

本插件提供基于大语言模型的智能对话功能，支持以下特性：

- 多平台模型接入（需配置API）
- 上下文历史管理
- Token用量统计
- 群组级别个性化配置
- 系统提示词模板
- JSON格式解析

## 使用命令

### 基础对话

```bash
chat <'消息内容'>
# 示例： chat 你好
```

默认对话会自动拼接命令前 `maxHistory - 2` 条消息进行多人场景对话，默认多人聊天场景prompt会使用json格式用以区分用户及其所对应的内容例如:

```json
{"userName": "张三", "userContent": "闲聊内容"}
{"userName": "李四", "userContent": "闲聊内容"}
// 触发命令的消息不会把指令前缀加进去
{"userName": "王五", "userContent": "问题内容"}
// 大模型回复后会自动把回复内容加进去，如果是R1推理模型，会排除思考内容，仅添加回复内容
{"userName": "botNickName", "userContent": "回复"}
```

### 无历史对话

```bash
chatnh <'消息内容'>
# 示例： chatnh 你好
```

### 清除对话历史

```bash
chat-clear
```

### 查看模型列表

```bash
chat-list
```

## 功能细节

### 系统提示词模板

支持使用 `$guildId` 变量，自动替换为当前群组ID

### Token用量统计

- 默认用户额度：10,000 tokens
- 用量查看：回复消息包含剩余额度
- 配置路径：可前往数据库调整数据
