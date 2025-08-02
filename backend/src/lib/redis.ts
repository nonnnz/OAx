import Redis from 'ioredis'

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
    },
})

// Add error handling
redis.on('error', (error) => {
    // console.log(process.env.REDIS_URL)
    console.error('Redis connection error:', error)
})

redis.on('connect', () => {
    console.log('Successfully connected to Redis')
})

export default redis