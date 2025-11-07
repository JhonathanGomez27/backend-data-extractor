export default () => ({
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.APP_PORT, 10) || 3000,
    jwt: {
        secret: process.env.JWT_SECRET || 'defaultSecret',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
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
    }
})