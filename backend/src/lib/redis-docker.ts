import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
    },
})

// Add error handling
redis.on('error', (error) => {
    console.log(process.env.REDIS_URL)
    console.error('Redis connection error:', error)
})

redis.on('connect', () => {
    console.log('Successfully connected to Redis')
})

export default redis
