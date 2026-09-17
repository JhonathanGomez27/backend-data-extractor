export default () => ({
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.APP_PORT, 10) || 3000,
    jwt: {
        secret: process.env.JWT_SECRET || 'defaultSecret',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'defaultRefreshSecret',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        user: process.env.DB_USERNAME || 'user',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'app_db'
    },
    admin: {
        email: process.env.ADMIN_USERNAME || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'adminPassword',
    },
    ai: {
        defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your_openai_api_key_here',
        contextModel: process.env.OPENAI_CONTEXT_MODEL || 'gpt-4.1',
        summaryModel: process.env.OPENAI_SUMMARY_MODEL || 'gpt-4.1-mini',
        contextLimit: parseInt(process.env.OPENAI_CONTEXT_LIMIT, 10) || 1_000_000
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.7-flash',
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-haiku-20241022',
    },
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-chat',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || 'your_telegram_bot_token_here',
        chatId: process.env.TELEGRAM_CHAT_ID || 'your_telegram_chat_id_here'
    }
})