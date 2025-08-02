import { Elysia, t } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { swagger } from '@elysiajs/swagger'
import { userRoutes } from './routes/user'
import { storeRoutes } from './routes/store'
import { botRoutes } from './routes/bot'
import { lineCallbackPlugin } from './plugins/lineCallbackPlugin'
import { cors } from '@elysiajs/cors'
import redis from './lib/redis'

const app = new Elysia()
    .use(opentelemetry())
    .use(
        swagger({
            documentation: {
                info: {
                    title: 'OAx Documentation',
                    version: '1.0.0',
                },
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                        },
                    },
                },
            },
        })
    )
    .use(
        cors({
            origin: [
                process.env.FRONTEND_URL || '',
                'https://localhost:5173',
                'https://91a5-184-82-216-231.ngrok-free.app',
                'http://localhost:5173',
                'https://khaki-files-watch.loca.lt',
                'https://f8c4993be475.ngrok-free.app',
                'https://nelson-recent-understanding-evaluations.trycloudflare.com',
            ],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            // credentials: true,
        })
    )
    .use(staticPlugin())
    .onError(({ error, code }) => {
        if (code === 'NOT_FOUND') return

        console.error(error)
    })
    .get('/api/test', () => {
        return 'Hello World'
    })
    .patch('/api/test', ({ body }) => {
        console.log(body)
        return 'Hello World'
    })
    .group('/api/v1', (app) => app.use(userRoutes).use(storeRoutes))

    .group('/api/v1/bot', (app) => app.use(botRoutes))
    .use(lineCallbackPlugin)

    .listen(process.env.BACKEND_PORT || 3000)

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
