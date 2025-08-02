const transformResponse = <T>(data: T, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toLocaleString(),
})

const transformError = (error: Error) => ({
    success: false,
    error: {
        type: error.name,
        message: error.message,
    },
    timestamp: new Date().toLocaleString(),
})

export { transformResponse, transformError }
