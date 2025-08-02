import { Elysia, t } from 'elysia'
import { db } from '../lib/db'
import axios from 'axios'
import { Role, LineUserProfile } from '../types'
import { transformError, transformResponse } from '../lib/utils'
import { resolve } from 'bun'

// RBAC middleware
const checkRole = (requiredRoles: Role[]) => ({
    beforeHandle: async ({
        headers,
        error,
    }: {
        headers: { authorization?: string }
        error: (status: number, data: any) => void
    }) => {
        const accessToken = headers.authorization?.split(' ')[1]
        if (!accessToken)
            return error(401, {
                success: false,
                message: 'Missing or invalid authorization header',
            })

        const lineProfile = await validateLIFFToken(accessToken)
        const user = await db.user.findUnique({
            where: { lineId: lineProfile.userId },
        })

        if (!user)
            return error(401, { success: false, message: 'User not found' })
        // console.log(requiredRoles, Role[user.role as keyof typeof Role])
        if (!requiredRoles.includes(Role[user.role as keyof typeof Role])) {
            return error(403, {
                success: false,
                message: 'Insufficient permissions',
            })
        }
    },
})

// Helper function to validate Line token
const validateLIFFToken = async (
    accessToken: string
): Promise<LineUserProfile> => {
    // For testing purposes
    if (accessToken == 'root') {
        const lineProfile = {
            userId: 'Root',
            displayName: '',
            pictureUrl: '',
            statusMessage: '',
        }
        return lineProfile
    }
    //

    try {
        const response = await axios.get('https://api.line.me/v2/profile', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
        return response.data
    } catch (error) {
        throw new Error('Failed to validate LIFF token')
    }
}

// Service with token validation
export const lineAuthService = new Elysia({ name: 'line/auth' })
    .state({
        db: db,
        lineProfiles: {} as Record<string, LineUserProfile>,
    })
    .model({
        lineAuth: t.Object({
            accessToken: t.String({ minLength: 1 }),
        }),
        userResponse: t.Object({
            success: t.Boolean(),
            data: t.Object({
                id: t.String(),
                lineId: t.Optional(t.String()),
                username: t.String(),
                role: t.String(),
                createdAt: t.String(),
                updatedAt: t.String(),
            }),
            message: t.Optional(t.String()),
            timestamp: t.String(),
        }),
        userUpdateBody: t.Object({
            username: t.Optional(t.String()),
            role: t.Optional(t.String()),
        }),
    })
    .onError(({ error }) => transformError(error as Error))
    .macro({
        validateLineToken: () => ({
            beforeHandle: async ({ headers, error, store }) => {
                const authHeader = headers.authorization
                // console.log(authHeader)
                if (!authHeader?.startsWith('Bearer ')) {
                    return error(401, {
                        success: false,
                        message: 'Missing or invalid authorization header',
                    })
                }

                const accessToken = authHeader.split(' ')[1]

                try {
                    const lineProfile = await validateLIFFToken(accessToken)
                    store.lineProfiles[accessToken] = lineProfile
                } catch (err) {
                    return error(401, {
                        success: false,
                        message: 'Invalid Line token',
                    })
                }
            },
        }),
        validateAdmin: () => ({
            beforeHandle: checkRole([Role.ADMIN]).beforeHandle,
        }),
    })

export const getUserData = new Elysia()
    .use(lineAuthService)
    .guard({
        as: 'scoped',
        validateLineToken: true,
    })
    .resolve(async ({ headers, store }) => {
        const authHeader = headers.authorization
        const accessToken = authHeader!.split(' ')[1]
        const lineProfile = store.lineProfiles[accessToken]

        const user = await db.user.findUnique({
            where: { lineId: lineProfile.userId },
        })

        return {
            lineProfile,
            lineId: lineProfile.userId,
            userId: user?.id,
        }
    })
    .as('plugin')
    .macro({
        validateStoreId: () => ({
            beforeHandle: async ({
                store,
                error,
                params: { storeId },
                userId,
                lineId,
            }) => {
                console.log('Checking store access:', {
                    lineId,
                    userId,
                    storeId: storeId,
                })
                const storeData = await store.db.user.findUnique({
                    where: { id: userId },
                    include: { stores: { where: { id: storeId } } },
                })
                console.log(storeData)
                if (storeData?.stores.length === 0) {
                    return error(403, {
                        success: false,
                        message: 'User does not have access to this store',
                    })
                }
            },
        }),
    })

// Main user routes
export const userRoutes = new Elysia({ prefix: '/user' })
    // .use(lineAuthService)
    .use(getUserData)

    // Get user info
    .get(
        '/',
        async ({ store: { db }, lineId }) => {
            const user = await db.user.findUnique({
                where: { lineId: lineId },
            })

            console.log(user)
            if (!user) throw new Error('User not found')

            const formattedUser = {
                ...user,
                createdAt: new Date(user.createdAt).toLocaleString(),
                updatedAt: new Date(user.updatedAt).toLocaleString(),
            }

            return transformResponse(
                formattedUser,
                'User retrieved successfully'
            )
        },
        {
            response: t.Object({
                success: t.Boolean(),
                data: t.Optional(
                    t.Object({
                        id: t.String(),
                        lineId: t.Optional(t.String()),
                        username: t.String(),
                        role: t.String(),
                        createdAt: t.String(),
                        updatedAt: t.String(),
                    })
                ),
            }),
            detail: {
                tags: ['user'],
            },
        }
    )
    .post(
        '/auth',
        async ({ store: { db }, lineProfile }) => {
            // Find or create user
            const user = await db.user.upsert({
                where: { lineId: lineProfile.userId },
                update: {
                    username: lineProfile.displayName,
                    updatedAt: new Date(),
                },
                create: {
                    lineId: lineProfile.userId,
                    username: lineProfile.displayName,
                },
            })

            const formattedUser = {
                ...user,
                createdAt: new Date(user.createdAt).toLocaleString(),
                updatedAt: new Date(user.updatedAt).toLocaleString(),
            }

            return transformResponse(
                formattedUser,
                'User authenticated successfully'
            )
        },
        {
            response: t.Object({
                success: t.Boolean(),
                data: t.Object({
                    id: t.String(),
                    lineId: t.Optional(t.String()),
                    username: t.String(),
                    role: t.String(),
                    createdAt: t.String(),
                    updatedAt: t.String(),
                }),
            }),
            detail: {
                tags: ['user', 'auth'],
            },
        }
    )
    // List all users (admin only)
    .get(
        '/all',
        async ({ store: { db }, query }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 10
            const skip = (page - 1) * limit

            const [users, total] = await Promise.all([
                db.user.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.user.count(),
            ])

            const formattedUsers = users.map((user) => ({
                ...user,
                createdAt: new Date(user.createdAt).toLocaleString(),
                updatedAt: new Date(user.updatedAt).toLocaleString(),
            }))

            return transformResponse(
                {
                    users: formattedUsers,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                },
                'Users retrieved successfully'
            )
        },
        {
            validateAdmin: true,
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
            }),
            detail: {
                tags: ['user', 'admin'],
            },
        }
    )
    // Delete user (admin only)
    .delete(
        '/:id',
        async ({ params: { id }, store: { db } }) => {
            await db.user.delete({
                where: { id },
            })

            return transformResponse(null, 'User deleted successfully')
        },
        {
            validateAdmin: true,
            detail: {
                tags: ['user', 'admin'],
            },
        }
    )
// .get('/me', ({ lineProfile, userId }) => {
//     return transformResponse(
//         {
//             lineProfile,
//             userId,
//         },
//         'User data retrieved successfully'
//     )
// })
