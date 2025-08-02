import { Elysia, error, file, t } from 'elysia'
import { transformResponse, transformError } from '../lib/utils'
import { getUserData } from './user'
import axios from 'axios'
import {
    StoreCreateBody,
    storeCreateBody,
    storeUpdateBody,
    accountSchema,
    lineOABotSchema,
    openingHourSchema,
    lineOABotUpdateBody,
    productCreateBody,
    productUpdateBody,
    ingredientCreateBody,
    ingredientUpdateBody,
    receiptCreateBody,
    receiptUpdateBody,
    orderCreateBody,
    orderUpdateBody,
    IngredientInfo,
    IngredientCreate,
    transactionCreateBody,
    transactionUpdateBody,
    Account,
} from '../types'
import path from 'path'
import ollama from 'ollama'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

import { createWorker } from 'tesseract.js'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import sharp from 'sharp'
import { GoogleGenAI, Type } from '@google/genai'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Message } from '@line/bot-sdk/dist/messaging-api/model/message'

export function validateProductFormData(formData: any) {
    try {
        let parsedIngredientInfo: IngredientInfo[] = []
        let parsedIngredient: IngredientCreate[] = []

        if (formData.ingredientInfo) {
            try {
                parsedIngredientInfo = JSON.parse(formData.ingredientInfo)
                // Validate each item against the schema
                parsedIngredientInfo.forEach((info) => {
                    // Check required fields
                    if (!info.ingredientId || info.ingredientId.length === 0) {
                        throw new Error(
                            'Invalid ingredientId in ingredientInfo'
                        )
                    }
                    if (
                        !info.ingredientName ||
                        info.ingredientName.length < 1
                    ) {
                        throw new Error(
                            'Invalid ingredientName in ingredientInfo'
                        )
                    }
                    if (
                        typeof info.ingredientQuantity !== 'number' ||
                        info.ingredientQuantity < 0
                    ) {
                        throw new Error(
                            'Invalid ingredientQuantity in ingredientInfo'
                        )
                    }
                    if (
                        !info.ingredientUnit ||
                        info.ingredientUnit.length < 1
                    ) {
                        throw new Error(
                            'Invalid ingredientUnit in ingredientInfo'
                        )
                    }
                })
            } catch (error) {
                throw new Error(
                    `Failed to parse ingredientInfo: ${error.message}`
                )
            }
        }

        if (formData.ingredient) {
            try {
                parsedIngredient = JSON.parse(formData.ingredient)
                // Validate each item against the schema
                parsedIngredient.forEach((ing) => {
                    if (!ing.name || ing.name.length < 1) {
                        throw new Error('Invalid name in ingredient')
                    }
                    if (!ing.unit || ing.unit.length < 1) {
                        throw new Error('Invalid unit in ingredient')
                    }
                })
            } catch (error) {
                throw new Error(`Failed to parse ingredient: ${error.message}`)
            }
        }

        if (!formData.name || formData.name.length < 1) {
            throw new Error('Name is required and must be at least 1 character')
        }

        // Validate price
        const priceNum = Number(formData.price)
        if (isNaN(priceNum) || priceNum < 0) {
            throw new Error('Price must be a valid non-negative number')
        }

        return {
            name: formData.name,
            description: formData.description || '',
            price: priceNum,
            ingredientInfo: parsedIngredientInfo,
            ingredient: parsedIngredient,
        }
    } catch (error) {
        throw error
    }
}

export const storeRoutes = new Elysia({ prefix: '/store' })
    .use(getUserData)

    // Store

    .get(
        '/',
        async ({ store: { db }, query, userId }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 10
            const skip = (page - 1) * limit

            const userWithStores =
                (await db.user.findUnique({
                    where: { id: userId },
                    include: {
                        stores: {
                            select: {
                                id: true,
                                storeName: true,
                                createdAt: true,
                                updatedAt: true,
                            },
                        },
                    },
                })) || null
            console.log(userWithStores)
            if (!userWithStores) {
                throw new Error('User not found')
            }

            const storesWithRoles = userWithStores.stores.map((store) => {
                const roleInfo = userWithStores.storeRoles.find(
                    (r) => r.storeId === store.id
                ) || { role: '', assignedAt: '' }
                return {
                    ...store,
                    role: roleInfo.role,
                    assignedAt: roleInfo.assignedAt,
                }
            })

            const total = storesWithRoles.length || 0

            console.log(storesWithRoles)

            const formattedStores = storesWithRoles?.map((storesWithRole) => ({
                ...storesWithRole,
                createdAt: new Date(storesWithRole.createdAt).toLocaleString(),
                updatedAt: new Date(storesWithRole.updatedAt).toLocaleString(),
                assignedAt: new Date(
                    storesWithRole.assignedAt
                ).toLocaleString(),
            }))

            return transformResponse(
                {
                    stores: formattedStores,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                },
                'Stores retrieved successfully'
            )
        },
        {
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
            }),
            detail: {
                tags: ['store'],
            },
        }
    )
    .get(
        '/:storeId',
        async ({ params: { storeId }, store: { db } }) => {
            const store = await db.store.findUnique({ where: { id: storeId } })
            return transformResponse(store, 'Store retrieved successfully')
        },
        {
            detail: {
                tags: ['store'],
            },
        }
    )
    .post(
        '/',
        async ({ body, store: { db }, lineId }) => {
            const user = await db.user.findUnique({
                where: { lineId: lineId },
            })

            if (!user) throw new Error('User not found')

            try {
                const getBotId = await axios.get(
                    `https://api.line.me/v2/bot/info`,
                    {
                        headers: {
                            Authorization: `Bearer ${body.lineOABot
                                .channelAccessToken!}`,
                        },
                    }
                )
                body.lineOABot.botId = getBotId.data.userId
                body.lineOABot.basicId = getBotId.data.basicId
                body.lineOABot.displayName = getBotId.data.displayName
            } catch (error) {
                throw new Error('Invalid token')
            }

            console.log(body)

            const store = await db.store.create({
                data: {
                    ...(body as StoreCreateBody),
                    userIDs: [user.id],
                },
            })

            await db.user.update({
                where: { id: user.id },
                data: {
                    storeIDs: {
                        push: store.id,
                    },
                    storeRoles: {
                        push: {
                            storeId: store.id,
                            role: 'OWNER',
                            assignedAt: new Date(),
                        },
                    },
                },
            })

            const formattedStore = {
                ...store,
                createdAt: new Date(store.createdAt).toLocaleString(),
                updatedAt: new Date(store.updatedAt).toLocaleString(),
            }

            return transformResponse(
                formattedStore,
                'Store created successfully'
            )
        },
        {
            body: storeCreateBody,
            detail: {
                tags: ['store'],
            },
        }
    )
    .patch(
        '/:storeId',
        async ({ params: { storeId }, body, store: { db } }) => {
            try {
                // Filter out undefined fields to only update what is changed
                const updateData = Object.fromEntries(
                    Object.entries(body).filter(([_, v]) => v !== undefined)
                )

                const updatedStore = await db.store.update({
                    where: { id: storeId },
                    data: updateData,
                })

                return transformResponse(
                    {
                        ...updatedStore,
                        createdAt: new Date(
                            updatedStore.createdAt
                        ).toLocaleString(),
                        updatedAt: new Date(
                            updatedStore.updatedAt
                        ).toLocaleString(),
                    },
                    'Store updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: storeUpdateBody,
            detail: {
                tags: ['store'],
            },
        }
    )
    // delete every things
    .delete(
        '/:storeId',
        async ({ params: { storeId }, store: { db } }) => {
            try {
                // await db.store.delete({
                //     where: { id: storeId },
                // })
                // await db.user.updateMany({
                //     where: { stores: { some: { id: storeId } } },
                //     data: {
                //         storeIDs: {
                //             set: [],
                //         },
                //         storeRoles: {
                //             set: [],
                //         },
                //         stores: { deleteMany: {} },
                //     },
                //     include: { stores: true },
                // })

                // Disconnect all store related
                const storeUsers = await db.store.delete({
                    where: { id: storeId },
                    include: {
                        users: true,
                    },
                })
                // console.log(storeUsers)
                return transformResponse(
                    storeUsers,
                    'Store deleted successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['store'],
            },
        }
    )
    .patch(
        '/:storeId/accounts',
        async ({ params: { storeId }, body, store: { db } }) => {
            try {
                // const existingStore = await db.store.findUnique({
                //     where: { id: storeId },
                //     select: { accounts: true }, // Only fetch accounts
                // })

                // if (!existingStore) {
                //     throw new Error('Store not found')
                // }

                const updatedAccounts = [...body.accounts]

                const updatedStore = await db.store.update({
                    where: { id: storeId },
                    data: { accounts: updatedAccounts },
                })

                return transformResponse(
                    updatedStore,
                    'Accounts updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: t.Object({ accounts: t.Array(accountSchema) }),
            detail: {
                tags: ['store'],
            },
        }
    )
    .delete(
        '/:storeId/accounts/:index',
        async ({ params: { storeId, index }, store: { db }, error }) => {
            try {
                const existingStore = await db.store.findUnique({
                    where: { id: storeId },
                    select: { accounts: true },
                })

                if (!existingStore) {
                    throw new Error('Store not found')
                }

                const accounts = existingStore.accounts
                const accountIndex = Number(index)
                if (
                    isNaN(accountIndex) ||
                    accountIndex < 0 ||
                    accountIndex >= existingStore.accounts.length
                ) {
                    throw new Error('Invalid account index')
                }

                // Remove the account at the given index
                accounts.splice(accountIndex, 1)

                const updatedStore = await db.store.update({
                    where: { id: storeId },
                    data: { accounts },
                })

                return transformResponse(
                    updatedStore,
                    'Account removed successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['store'],
            },
        }
    )
    .patch(
        '/:storeId/line-oabot',
        async ({ params: { storeId }, body, store: { db } }) => {
            try {
                const existingStore = await db.store.findUnique({
                    where: { id: storeId },
                    select: { lineOABot: true },
                })
                if (!existingStore) {
                    throw new Error('Store not found')
                }

                if (
                    existingStore.lineOABot.channelAccessToken ===
                        body.channelAccessToken ||
                    existingStore.lineOABot.channelSecret === body.channelSecret
                ) {
                    throw new Error('No change detected')
                }

                const getBotInfo = await axios.get(
                    `https://api.line.me/v2/bot/info`,
                    {
                        headers: {
                            Authorization: `Bearer ${body.channelAccessToken}`,
                        },
                    }
                )

                const newLineOABot = {
                    channelSecret: body.channelSecret,
                    channelAccessToken: body.channelAccessToken,
                    botId: getBotInfo.data.userId,
                    basicId: getBotInfo.data.basicId,
                    displayName: getBotInfo.data.displayName,
                }

                const updatedStore = await db.store.update({
                    where: { id: storeId },
                    data: { lineOABot: newLineOABot },
                })

                return transformResponse(
                    {
                        ...updatedStore,
                        createdAt: new Date(
                            updatedStore.createdAt
                        ).toLocaleString(),
                        updatedAt: new Date(
                            updatedStore.updatedAt
                        ).toLocaleString(),
                    },
                    'Line OA Bot updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: lineOABotUpdateBody,
            detail: {
                tags: ['store'],
            },
        }
    )

    // List all stores (admin only)
    .get(
        '/all',
        async ({ store: { db }, query }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 10
            const skip = (page - 1) * limit

            const [stores, total] = await Promise.all([
                db.store.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.store.count(),
            ])

            const formattedStores = stores.map((store) => ({
                ...store,
                createdAt: new Date(store.createdAt).toLocaleString(),
                updatedAt: new Date(store.updatedAt).toLocaleString(),
            }))

            return transformResponse(
                {
                    stores: formattedStores,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                },
                'Stores retrieved successfully'
            )
        },
        {
            validateAdmin: true,
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
            }),
            detail: {
                tags: ['store', 'admin'],
            },
        }
    )

    // Products
    .guard({
        as: 'scoped',
        validateStoreId: true,
    })
    .get(
        '/:storeId/products',
        async ({ store: { db }, query, params: { storeId } }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 10
            const skip = (page - 1) * limit

            const [products, total] = await Promise.all([
                db.product.findMany({
                    where: storeId ? { storeId } : {},
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.product.count({
                    where: storeId ? { storeId } : {},
                }),
            ])

            const formattedProducts = products.map((product) => ({
                ...product,
                createdAt: new Date(product.createdAt).toLocaleString(),
                updatedAt: new Date(product.updatedAt).toLocaleString(),
            }))

            return transformResponse(
                {
                    products: formattedProducts,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                },
                'Products retrieved successfully'
            )
        },
        {
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
                storeId: t.Optional(t.String()),
            }),
            detail: {
                tags: ['product'],
            },
        }
    )
    .get(
        '/:storeId/products/:pdId',
        async ({ params: { storeId, pdId }, store: { db } }) => {
            const product = await db.product.findUnique({ where: { id: pdId } })
            if (!product || product.storeId !== storeId) {
                throw new Error('Product not found in specified store')
            }
            return transformResponse(product, 'Product retrieved successfully')
        },
        {
            detail: {
                tags: ['product'],
            },
        }
    )
    .post(
        '/:storeId/products',
        async ({ params: { storeId }, body, store: { db } }) => {
            console.log(body)
            const { ingredientInfo, ingredient } = validateProductFormData(body)
            console.log(ingredientInfo, ingredient)
            // return
            try {
                const getProduct = {
                    name: body.name,
                    imageUrl: '/products/package.svg',
                    description: body.description,
                    price: Number(body.price),
                }
                console.log(getProduct)
                const product = await db.product.create({
                    data: {
                        ...getProduct,
                        storeId,
                    },
                })

                // Handle file upload if exists
                if (body?.image) {
                    const fileExtension = body.image.name.split('.').pop()
                    const fileName = `${product.id}.${fileExtension}`
                    const publicPath = `public/products/${fileName}`

                    // Ensure directory exists
                    await Bun.write(Bun.file(publicPath), body.image)

                    // Update the product with the image URL
                    const imageUrl = `/products/${fileName}`
                    await db.product.update({
                        where: { id: product.id },
                        data: { imageUrl },
                    })

                    // Update local object
                    product.imageUrl = imageUrl
                }

                const ingredientsData =
                    ingredient?.map((ingredient) => ({
                        ...ingredient,
                        quantity: 0,
                        productIDs: [product.id],
                    })) || []

                const pdIngredientsData =
                    ingredientInfo?.map((ingredient) => ({
                        ...ingredient,
                    })) || []

                console.log('ingredientData:', ingredientsData)
                console.log('pdIngredientsData:', pdIngredientsData)
                if (ingredientsData.length || pdIngredientsData.length) {
                    // Check for already-existing ingredients for this store
                    const existingIngredients = await db.store.findUnique({
                        where: { id: storeId },
                        select: {
                            products: {
                                select: {
                                    ingredients: {
                                        select: {
                                            id: true,
                                            name: true,
                                            quantity: true,
                                            unit: true,
                                            productIDs: true,
                                        },
                                    },
                                },
                            },
                        },
                    })
                    const filterStoreIngredients = Array.from(
                        new Map(
                            existingIngredients?.products
                                .flatMap((product) => product.ingredients)
                                .map((ingredient) => [
                                    ingredient.name,
                                    ingredient,
                                ])
                        ).values()
                    )

                    // Filter any ingredients that already exist
                    const filteredIngredients = filterStoreIngredients.filter(
                        (ingredient) => {
                            return ingredientsData.some(
                                (ing) => ing.name === ingredient.name
                            )
                        }
                    )
                    console.log('Filtered Ingredients:', filteredIngredients)

                    // console.log('existingIngredients:', existingIngredients)

                    if (filteredIngredients.length > 0) {
                        // remove existing ingredients from ingredientsData
                        filteredIngredients.forEach((ingredient) => {
                            const index = ingredientsData.findIndex(
                                (i) => i.name === ingredient.name
                            )
                            if (index !== -1) {
                                ingredientsData.splice(index, 1)
                            }
                        })
                        // replace existing ingredients id in pdIngredientsData
                        filteredIngredients.forEach((ingredient) => {
                            const index = pdIngredientsData.findIndex(
                                (i) => i.ingredientName === ingredient.name
                            )
                            if (index !== -1) {
                                pdIngredientsData[index].ingredientId =
                                    ingredient.id
                            }
                        })
                        // update the ingredient productIds
                        filteredIngredients.forEach(async (ingredient) => {
                            await db.ingredient.update({
                                where: { id: ingredient.id },
                                data: {
                                    productIDs: {
                                        push: product.id,
                                    },
                                },
                            })
                        })
                    }

                    if (ingredientsData.length > 0) {
                        const ingredients = await Promise.all(
                            ingredientsData.map((ingredient) =>
                                db.ingredient.create({
                                    data: ingredient,
                                })
                            )
                        )

                        console.log(ingredients)

                        // update ingredientInfo
                        pdIngredientsData.forEach((pdIngredient) => {
                            const index = ingredients.findIndex(
                                (i) => i.name === pdIngredient.ingredientName
                            )
                            if (index !== -1) {
                                pdIngredient.ingredientId =
                                    ingredients[index].id
                            }
                        })
                    }
                    if (pdIngredientsData.length > 0) {
                        // is existing ingredients has productIDs?
                        filterStoreIngredients.forEach(async (ingredient) => {
                            const index = pdIngredientsData.findIndex(
                                (i) => i.ingredientId === ingredient.id
                            )
                            if (index !== -1) {
                                if (
                                    !ingredient.productIDs.includes(product.id)
                                ) {
                                    await db.ingredient.update({
                                        where: { id: ingredient.id },
                                        data: {
                                            productIDs: {
                                                push: product.id,
                                            },
                                        },
                                    })
                                }
                            }
                        })
                    }
                    console.log('pdIngredientsData:', pdIngredientsData)

                    const updatedProduct = await db.product.update({
                        where: { id: product.id },
                        data: {
                            ingredientIDs: {
                                push: pdIngredientsData.map(
                                    (i) => i.ingredientId
                                ),
                            },
                            ingredientInfo: {
                                push: pdIngredientsData,
                            },
                        },
                    })

                    console.log('updatedProduct:', updatedProduct)

                    const formattedProduct = {
                        ...updatedProduct,
                        createdAt: new Date(
                            updatedProduct.createdAt
                        ).toLocaleString(),
                        updatedAt: new Date(
                            updatedProduct.updatedAt
                        ).toLocaleString(),
                    }

                    return transformResponse(
                        formattedProduct,
                        'Product created successfully'
                    )
                } else {
                    const formattedProduct = {
                        ...product,
                        createdAt: new Date(product.createdAt).toLocaleString(),
                        updatedAt: new Date(product.updatedAt).toLocaleString(),
                    }

                    return transformResponse(
                        formattedProduct,
                        'Product created successfully'
                    )
                }
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: productCreateBody,

            detail: {
                tags: ['product'],
            },
        }
    )
    .patch(
        '/:storeId/products/:pdId',
        async ({ params: { storeId, pdId }, body, store: { db } }) => {
            // const { ingredient, ingredientInfo, image, ...productFields } = body
            console.log(body)
            // return
            console.log(body, pdId, storeId)
            const { ingredient, ingredientInfo } = validateProductFormData(body)
            const productFields = {
                name: body.name,
                description: body.description,
                price: Number(body.price),
                isActive: body.isActive === 'true' ? true : false,
            }
            // return
            // Update main product fields
            let updatedProduct = await db.product.update({
                where: { id: pdId },
                data: productFields,
            })

            if (body?.image) {
                const fileExtension = body.image.name.split('.').pop()
                const fileName = `${pdId}.${fileExtension}`
                const publicPath = `public/products/${fileName}`

                await Bun.write(Bun.file(publicPath), body.image)

                const imageUrl = `/products/${fileName}`
                await db.product.update({
                    where: { id: pdId },
                    data: { imageUrl },
                })

                updatedProduct.imageUrl = imageUrl
            }

            const ingredientsData =
                ingredient?.map((ing) => ({
                    ...ing,
                    quantity: 0,
                    productIDs: [pdId],
                })) || []

            const pdIngredientsData =
                ingredientInfo
                    ?.filter((ing) => ing.ingredientId !== '')
                    .map((ing) => ({ ...ing })) || []
            console.log('pdIngredientsData:', pdIngredientsData)

            if (ingredientsData.length > 0 || pdIngredientsData.length > 0) {
                // only new ingredients
                const newPdIngredients =
                    ingredientInfo
                        ?.filter(
                            (ing) =>
                                ing.ingredientId === '' ||
                                ing.ingredientId.startsWith('mock-up-')
                        )
                        .map((ing) => ({
                            ingredientId: '',
                            ingredientName: ing.ingredientName,
                            ingredientUnit: ing.ingredientUnit,
                            ingredientQuantity: ing.ingredientQuantity,
                        })) || []
                console.log('newPdIngredients:', newPdIngredients)
                // Check for already-existing ingredients for this store
                const existingIngredients = await db.store.findUnique({
                    where: { id: storeId },
                    select: {
                        products: {
                            select: {
                                ingredients: {
                                    select: {
                                        id: true,
                                        name: true,
                                        quantity: true,
                                        unit: true,
                                        productIDs: true,
                                    },
                                },
                            },
                        },
                    },
                })
                const filterStoreIngredients = Array.from(
                    new Map(
                        existingIngredients?.products
                            .flatMap((product) => product.ingredients)
                            .map((ingredient) => [ingredient.name, ingredient])
                    ).values()
                )

                // Filter any ingredients that already exist
                const filteredIngredients = filterStoreIngredients.filter(
                    (ingredient) => {
                        return ingredientsData.some(
                            (ing) => ing.name === ingredient.name
                        )
                    }
                )

                if (filteredIngredients.length) {
                    // Remove existing ingredients from ingredientsData
                    filteredIngredients.forEach((ingredient) => {
                        const index = ingredientsData.findIndex(
                            (i) => i.name === ingredient.name
                        )
                        if (index !== -1) {
                            ingredientsData.splice(index, 1)
                        }
                    })
                    // Replace ingredient names with their ids in newPdIngredients
                    filteredIngredients.forEach((ingredient) => {
                        const index = newPdIngredients.findIndex(
                            (i) => i.ingredientName === ingredient.name
                        )
                        if (index !== -1) {
                            newPdIngredients[index].ingredientId = ingredient.id
                        }
                    })

                    // Update the productIDs for each existing ingredient
                    for (const ingredient of filteredIngredients) {
                        await db.ingredient.update({
                            where: { id: ingredient.id },
                            data: {
                                productIDs: {
                                    push: pdId,
                                },
                            },
                        })
                    }
                }

                // Create new ingredients if any remain in ingredientsData
                if (ingredientsData.length > 0) {
                    const newIngredients = await Promise.all(
                        ingredientsData.map((ingredient) =>
                            db.ingredient.create({
                                data: ingredient,
                            })
                        )
                    )
                    // Update newPdIngredients with newly created ingredient ids
                    pdIngredientsData.forEach((pdIngredient) => {
                        const index = newIngredients.findIndex(
                            (i) => i.name === pdIngredient.ingredientName
                        )
                        if (index !== -1) {
                            pdIngredient.ingredientId = newIngredients[index].id
                        }
                    })
                }
                if (pdIngredientsData.length > 0) {
                    // is existing ingredients has productIDs?
                    filterStoreIngredients.forEach(async (ingredient) => {
                        const index = pdIngredientsData.findIndex(
                            (i) => i.ingredientId === ingredient.id
                        )
                        if (index !== -1) {
                            if (!ingredient.productIDs.includes(pdId)) {
                                await db.ingredient.update({
                                    where: { id: ingredient.id },
                                    data: {
                                        productIDs: {
                                            push: pdId,
                                        },
                                    },
                                })
                            }
                        }
                    })

                    // remove zero quantity ingredients
                    pdIngredientsData.forEach(async (pdIngredient) => {
                        if (pdIngredient.ingredientQuantity === 0) {
                            const index = pdIngredientsData.findIndex(
                                (i) =>
                                    i.ingredientId === pdIngredient.ingredientId
                            )
                            if (index !== -1) {
                                pdIngredientsData.splice(index, 1)
                                const ing = (await db.ingredient.findUnique({
                                    where: { id: pdIngredient.ingredientId },
                                    select: {
                                        productIDs: true,
                                    },
                                })) || { productIDs: [] }
                                const pdIndex = ing.productIDs.findIndex(
                                    (i) => i === pdId
                                )
                                if (pdIndex !== -1) {
                                    ing.productIDs.splice(pdIndex, 1)
                                }

                                if (ing.productIDs.length === 0) {
                                    await db.ingredient.delete({
                                        where: {
                                            id: pdIngredient.ingredientId,
                                        },
                                    })
                                } else {
                                    await db.ingredient.update({
                                        where: {
                                            id: pdIngredient.ingredientId,
                                        },
                                        data: {
                                            productIDs: ing.productIDs,
                                        },
                                    })
                                }
                            }
                        }
                    })
                }

                // pdIngredientsData.push(...newPdIngredients)

                // is ingredient has productIDs
                console.log('existingIngredients:', existingIngredients)
                console.log('filterStoreIngredients:', filterStoreIngredients)

                // Update the product with new ingredientIDs and ingredientInfo
                console.log('final pdIngredientsData:', pdIngredientsData)
                updatedProduct = await db.product.update({
                    where: { id: pdId },
                    data: {
                        ingredientIDs: pdIngredientsData.map(
                            (i) => i.ingredientId
                        ),
                        ingredientInfo: pdIngredientsData,
                    },
                })
            } else {
                const getProduct = await db.product.findUnique({
                    where: { id: pdId },
                })
                console.log(getProduct)
                if (getProduct?.ingredientIDs.length) {
                    const updatedIngredients = getProduct?.ingredientIDs.map(
                        async (ingId) => {
                            const ing = (await db.ingredient.findUnique({
                                where: { id: ingId },
                                select: {
                                    productIDs: true,
                                },
                            })) || { productIDs: [] }
                            const index = ing.productIDs.findIndex(
                                (i) => i === pdId
                            )
                            if (index !== -1) {
                                ing?.productIDs.splice(index, 1)
                            }
                            if (ing?.productIDs.length === 0) {
                                return await db.ingredient.delete({
                                    where: { id: ingId },
                                })
                            } else {
                                return await db.ingredient.update({
                                    where: { id: ingId },
                                    data: {
                                        productIDs: ing?.productIDs,
                                    },
                                })
                            }
                        }
                    )
                }
                // remove ingredientIDs and ingredientInfo
                updatedProduct = await db.product.update({
                    where: { id: pdId },
                    data: { ingredientIDs: [], ingredientInfo: [] },
                })
            }

            return transformResponse(
                {
                    ...updatedProduct,
                    createdAt: new Date(
                        updatedProduct.createdAt
                    ).toLocaleString(),
                    updatedAt: new Date(
                        updatedProduct.updatedAt
                    ).toLocaleString(),
                },
                'Product updated successfully'
            )
        },
        {
            body: productUpdateBody,
            detail: {
                tags: ['product'],
            },
        }
    )
    .delete(
        '/:storeId/products/:pdId',
        async ({ params: { storeId, pdId }, store: { db } }) => {
            try {
                const getProduct = await db.product.findUnique({
                    where: { id: pdId },
                })
                console.log(getProduct)
                if (getProduct?.ingredientIDs.length) {
                    const updatedIngredients = getProduct?.ingredientIDs.map(
                        async (ingId) => {
                            const ing = (await db.ingredient.findUnique({
                                where: { id: ingId },
                                select: {
                                    productIDs: true,
                                },
                            })) || { productIDs: [] }
                            const index = ing.productIDs.findIndex(
                                (i) => i === pdId
                            )
                            if (index !== -1) {
                                ing?.productIDs.splice(index, 1)
                            }
                            if (ing?.productIDs.length === 0) {
                                return await db.ingredient.delete({
                                    where: { id: ingId },
                                })
                            } else {
                                return await db.ingredient.update({
                                    where: { id: ingId },
                                    data: {
                                        productIDs: ing?.productIDs,
                                    },
                                })
                            }
                        }
                    )
                }

                if (!getProduct || getProduct.storeId !== storeId) {
                    throw new Error('Product not found in specified store')
                }

                await db.product.delete({
                    where: { id: pdId },
                })
                return transformResponse(null, 'Product deleted successfully')
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['product'],
            },
        }
    )

    // ingredient
    .get(
        '/:storeId/ingredient',
        async ({ params: { storeId }, store: { db }, query }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 10
            const skip = (page - 1) * limit

            const ingredients = await db.store.findUnique({
                where: { id: storeId },
                select: {
                    products: {
                        select: {
                            ingredients: {
                                select: {
                                    id: true,
                                    name: true,
                                    quantity: true,
                                    unit: true,
                                    createdAt: true,
                                    updatedAt: true,
                                    receiptInfo: true,
                                    receipts: true,
                                    productIDs: true,
                                },
                            },
                        },
                    },
                },
            })

            const filteredStoreIngredients = Array.from(
                new Map(
                    ingredients?.products
                        .flatMap((product) => product.ingredients)
                        .map((ingredient) => [ingredient.id, ingredient])
                ).values()
            )

            // const storeProducts = (await db.store.findUnique({
            //     where: { id: storeId },
            //     select: {
            //         products: {
            //             select: {
            //                 id: true,
            //             },
            //         },
            //     },
            // })) || { products: [{ id: '' }] }

            // const productIds = storeProducts.products.map((p) => p.id)

            // const ingredients = await db.ingredient.findMany({
            //     where: {
            //         productIDs: {
            //             hasSome: productIds,
            //         },
            //     },
            //     skip,
            //     take: limit,
            //     orderBy: {
            //         name: 'asc',
            //     },
            //     select: {
            //         id: true,
            //         name: true,
            //         quantity: true,
            //         unit: true,
            //         createdAt: true,
            //         updatedAt: true,
            //         // products: {
            //         //     select: {
            //         //         id: true,
            //         //         name: true,
            //         //     },
            //         // },
            //     },
            // })

            // const formattedIngredients = ingredients.map((i) => ({
            //     ...i,
            //     createdAt: new Date(i.createdAt).toLocaleString(),
            //     updatedAt: new Date(i.updatedAt).toLocaleString(),
            // }))

            return transformResponse(
                {
                    ingredients: filteredStoreIngredients,
                    pagination: {
                        page,
                        limit,
                        total: filteredStoreIngredients.length,
                        pages: Math.ceil(
                            filteredStoreIngredients.length / limit
                        ),
                    },
                },
                'Ingredients retrieved successfully'
            )
        },
        {
            query: t.Object({
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
            detail: {
                tags: ['ingredient'],
            },
        }
    )
    .get(
        '/:storeId/ingredient/:ingId',
        async ({ params: { ingId }, store: { db } }) => {
            const ingredient = await db.ingredient.findUnique({
                where: { id: ingId },
            })
            if (!ingredient) throw new Error('Ingredient not found')
            const formattedIngredient = {
                ...ingredient,
                createdAt: new Date(ingredient.createdAt).toLocaleString(),
                updatedAt: new Date(ingredient.updatedAt).toLocaleString(),
            }
            return transformResponse(
                formattedIngredient,
                'Ingredient retrieved successfully'
            )
        },
        {
            detail: {
                tags: ['ingredient'],
            },
        }
    )
    .patch(
        '/:storeId/ingredient/:ingId',
        async ({ params: { ingId }, body, store: { db } }) => {
            try {
                const updateData = Object.fromEntries(
                    Object.entries(body).filter(([_, v]) => v !== undefined)
                )
                const updatedIngredient = await db.ingredient.update({
                    where: { id: ingId },
                    data: updateData,
                })

                const formattedIngredient = {
                    ...updatedIngredient,
                    createdAt: new Date(
                        updatedIngredient.createdAt
                    ).toLocaleString(),
                    updatedAt: new Date(
                        updatedIngredient.updatedAt
                    ).toLocaleString(),
                }
                return transformResponse(
                    formattedIngredient,
                    'Ingredient updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: ingredientUpdateBody,
            detail: {
                tags: ['ingredient'],
            },
        }
    )
    .delete(
        '/:storeId/ingredient/:ingId',
        async ({ params: { ingId }, store: { db } }) => {
            try {
                const ingredientRelations = (await db.ingredient.findUnique({
                    where: { id: ingId },
                    select: {
                        productIDs: true,
                        receiptIDs: true,
                    },
                })) || { productIDs: [], receiptIDs: [] }
                if (ingredientRelations.productIDs.length) {
                    ingredientRelations.productIDs.map(async (pdId) => {
                        const product = await db.product.findUnique({
                            where: { id: pdId },
                            select: {
                                ingredientIDs: true,
                                ingredientInfo: true,
                            },
                        })
                        if (product) {
                            const index = product.ingredientIDs.findIndex(
                                (i) => i === ingId
                            )
                            if (index !== -1) {
                                product.ingredientIDs.splice(index, 1)
                            }
                            const pdIndex = product.ingredientInfo.findIndex(
                                (i) => i.ingredientId === ingId
                            )
                            if (pdIndex !== -1) {
                                product.ingredientInfo.splice(pdIndex, 1)
                            }
                            await db.product.update({
                                where: { id: pdId },
                                data: {
                                    ingredientIDs: product.ingredientIDs,
                                    ingredientInfo: product.ingredientInfo,
                                },
                            })
                        }
                    })
                }

                if (ingredientRelations.receiptIDs.length) {
                    ingredientRelations.receiptIDs.map(async (rcId) => {
                        const receipt = await db.receipt.findUnique({
                            where: { id: rcId },
                            select: {
                                ingredientIDs: true,
                            },
                        })
                        if (receipt) {
                            const index = receipt.ingredientIDs.findIndex(
                                (i) => i === ingId
                            )
                            if (index !== -1) {
                                receipt.ingredientIDs.splice(index, 1)
                            }
                            await db.receipt.update({
                                where: { id: rcId },
                                data: {
                                    ingredientIDs: receipt.ingredientIDs,
                                },
                            })
                        }
                    })
                }

                await db.ingredient.delete({
                    where: { id: ingId },
                })
                return transformResponse(
                    null,
                    'Ingredient deleted successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['ingredient'],
            },
        }
    )

    // receipt
    .get(
        '/:storeId/receipt',
        async ({ params: { storeId }, store: { db }, query }) => {
            try {
                const page = Number(query.page) || 1
                const limit = Number(query.limit) || 10
                const skip = (page - 1) * limit

                const receipts = await db.store.findUnique({
                    where: { id: storeId },
                    select: {
                        products: {
                            select: {
                                ingredients: {
                                    select: {
                                        receipts: true,
                                    },
                                },
                            },
                        },
                    },
                })

                const filteredStoreReceipts = Array.from(
                    new Map(
                        receipts?.products
                            .flatMap((product) => product.ingredients)
                            .flatMap((ingredient) => ingredient.receipts)
                            .map((receipt) => [receipt.id, receipt])
                    ).values()
                )

                const formattedReceipts = filteredStoreReceipts.map(
                    (receipt) => ({
                        ...receipt,
                        receiptsDate: new Date().toLocaleString(),
                        createdAt: new Date(receipt.createdAt).toLocaleString(),
                        updatedAt: new Date(receipt.updatedAt).toLocaleString(),
                    })
                )

                return transformResponse(
                    {
                        receipts: formattedReceipts,
                        pagination: {
                            page,
                            limit,
                            total: formattedReceipts.length,
                            pages: Math.ceil(formattedReceipts.length / limit),
                        },
                    },
                    'Receipts retrieved successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
            }),
            detail: {
                tags: ['receipt'],
            },
        }
    )
    .get(
        '/:storeId/receipt/:rptId',
        async ({ params: { rptId }, store: { db } }) => {
            try {
                const receipt = await db.receipt.findUnique({
                    where: { id: rptId },
                    include: {
                        ingredients: {
                            select: {
                                id: true,
                                name: true,
                                quantity: true,
                                unit: true,
                            },
                        },
                    },
                })

                if (!receipt) {
                    throw new Error('Receipt not found')
                }

                const formattedReceipt = {
                    ...receipt,
                    receiptsDate: new Date().toLocaleString(),
                    createdAt: new Date(receipt.createdAt).toLocaleString(),
                    updatedAt: new Date(receipt.updatedAt).toLocaleString(),
                }

                return transformResponse(
                    formattedReceipt,
                    'Receipt retrieved successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['receipt'],
            },
        }
    )
    .post(
        '/:storeId/receipt',
        async ({ body, store: { db } }) => {
            try {
                console.log('called', body)
                // return
                let receipt = await db.receipt.create({
                    data: {
                        imageUrl: body.imageUrl || '',
                        store: body.store,
                        receiptsRef: body.receiptsRef,
                        receiptsDate: new Date(body.receiptsDate),
                    },
                })

                const ingredientData = body.ingredients
                ingredientData.forEach(async (ingredient) => {
                    const receiptInfo = {
                        receiptId: receipt.id,
                        quantity: ingredient.quantity,
                        price: ingredient.price,
                        originalQuantity: ingredient.originalQuantity,
                        customUnit: ingredient.customUnit,
                        quantityUsed: 0,
                        receiptUsedOrder: [],
                        isActive: true,
                    }

                    if (
                        ingredient.ingId === '' ||
                        ingredient.ingId === undefined ||
                        ingredient.ingId.startsWith('mockup')
                    ) {
                        const ing = await db.ingredient.create({
                            data: {
                                name: ingredient.name,
                                quantity: ingredient.quantity,
                                unit: ingredient.unit,
                                productIDs: ingredient.products.map(
                                    (i) => i.pdId
                                ),
                                receiptIDs: [receipt.id],
                                receiptInfo: [receiptInfo],
                            },
                        })
                        ingredient.ingId = ing.id
                    } else {
                        await db.ingredient.update({
                            where: { id: ingredient.ingId },
                            data: {
                                quantity: {
                                    increment: ingredient.quantity,
                                },
                                unit: ingredient.unit,
                                productIDs: ingredient.products.map(
                                    (i) => i.pdId
                                ),
                                receiptIDs: {
                                    push: receipt.id,
                                },
                                receiptInfo: {
                                    push: receiptInfo,
                                },
                            },
                        })
                    }

                    // product update
                    ingredient.products.forEach(async (pd) => {
                        if (pd.isEdit) {
                            const getProduct = (await db.product.findUnique({
                                where: { id: pd.pdId },
                                select: {
                                    ingredientIDs: true,
                                    ingredientInfo: true,
                                },
                            })) || { ingredientIDs: [], ingredientInfo: [] }
                            if (
                                !getProduct.ingredientIDs.includes(
                                    ingredient.ingId
                                )
                            ) {
                                getProduct.ingredientIDs.push(ingredient.ingId)
                            }

                            const infoIdx = getProduct.ingredientInfo.findIndex(
                                (i) => i.ingredientId === ingredient.ingId
                            )
                            if (infoIdx !== -1) {
                                getProduct.ingredientInfo[
                                    infoIdx
                                ].ingredientQuantity = ingredient.quantity
                                getProduct.ingredientInfo[
                                    infoIdx
                                ].ingredientUnit = ingredient.unit
                            } else {
                                const tempInfo = {
                                    ingredientId: ingredient.ingId,
                                    ingredientName: ingredient.name,
                                    ingredientQuantity: pd.quantity,
                                    ingredientUnit: ingredient.unit,
                                }
                                getProduct.ingredientInfo.push(tempInfo)
                            }
                            await db.product.update({
                                where: { id: pd.pdId },
                                data: {
                                    ingredientIDs: getProduct.ingredientIDs,
                                    ingredientInfo: getProduct.ingredientInfo,
                                },
                            })
                        }
                    })
                    // receipt update
                    receipt = await db.receipt.update({
                        where: { id: receipt.id },
                        data: {
                            ingredientIDs: { push: ingredient.ingId },
                        },
                    })
                })

                const formattedReceipt = {
                    ...receipt,
                    receiptsDate: new Date().toLocaleString(),
                    createdAt: new Date(receipt.createdAt).toLocaleString(),
                    updatedAt: new Date(receipt.updatedAt).toLocaleString(),
                }

                return transformResponse(
                    formattedReceipt,
                    'Receipt created successfully'
                )
            } catch (error) {
                console.log('error', error)
                return transformError(error as Error)
            }
        },
        {
            body: receiptCreateBody,
            detail: {
                tags: ['receipt'],
            },
        }
    )
    .post(
        '/:storeId/receipt/:rptId/upload-image',
        async ({ params: { rptId, storeId }, body, store: { db } }) => {
            try {
                if (body?.image) {
                    const fileExtension = body.image.name.split('.').pop()
                    const fileName = `${rptId}.${fileExtension}`
                    // create directory if not exists
                    const publicPath = `public/receipts/${storeId}`
                    if (!fs.existsSync(publicPath)) {
                        fs.mkdirSync(publicPath, { recursive: true })
                    }

                    // Ensure directory exists
                    const filePath = `${publicPath}/${fileName}`
                    await Bun.write(Bun.file(filePath), body.image)

                    // Update the product with the image URL
                    const imageUrl = `/receipts/${storeId}/${fileName}`
                    const receipt = await db.receipt.update({
                        where: { id: rptId },
                        data: { imageUrl: imageUrl },
                        include: {
                            ingredients: true,
                        },
                    })

                    const formattedReceipt = {
                        ...receipt,
                        receiptsDate: new Date().toLocaleString(),
                        createdAt: new Date(receipt.createdAt).toLocaleString(),
                        updatedAt: new Date(receipt.updatedAt).toLocaleString(),
                    }
                    return transformResponse(
                        formattedReceipt,
                        'Receipt updated successfully'
                    )
                }

                return transformResponse(null, 'No image uploaded')
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: t.Object({
                image: t.File({
                    maxSize: 2 * 1024 * 1024,
                    types: ['image/*'],
                }),
            }),
            detail: {
                tags: ['receipt'],
            },
        }
    )
    // not finish
    .patch(
        '/:storeId/receipt/:rptId',
        async ({ params: { rptId }, body, store: { db } }) => {
            try {
                const updateData = Object.fromEntries(
                    Object.entries(body).filter(([_, v]) => v !== undefined)
                )

                const receipt = await db.receipt.update({
                    where: { id: rptId },
                    data: updateData,
                    include: {
                        ingredients: {
                            select: {
                                id: true,
                                name: true,
                                quantity: true,
                                unit: true,
                            },
                        },
                    },
                })

                const formattedReceipt = {
                    ...receipt,
                    receiptsDate: new Date().toLocaleString(),
                    createdAt: new Date(receipt.createdAt).toLocaleString(),
                    updatedAt: new Date(receipt.updatedAt).toLocaleString(),
                }

                return transformResponse(
                    formattedReceipt,
                    'Receipt updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: receiptUpdateBody,
            detail: {
                tags: ['receipt'],
            },
        }
    )
    .patch(
        '/:storeId/receipt/:rptId/:ingId',
        async ({ params: { rptId, ingId }, body, store: { db } }) => {
            try {
                const getIngredient = await db.ingredient.findUnique({
                    where: { id: ingId },
                    select: {
                        quantity: true,
                        receiptInfo: true,
                    },
                })

                if (!getIngredient) {
                    throw new Error('Ingredient not found')
                }

                getIngredient.receiptInfo.forEach((receipt) => {
                    if (receipt.receiptId === rptId) {
                        receipt.isActive = body.isActive
                    }
                })

                const receiptInfo = getIngredient.receiptInfo.find(
                    (r) => r.receiptId === rptId
                ) || {
                    quantityUsed: 0,
                    quantity: 0,
                }

                const updatedIngredient = await db.ingredient.update({
                    where: { id: ingId },
                    data: {
                        quantity: {
                            decrement:
                                receiptInfo?.quantity -
                                receiptInfo?.quantityUsed,
                        },
                        receiptInfo: getIngredient.receiptInfo,
                    },
                })

                const formattedReceipt = {
                    ...updatedIngredient,

                    createdAt: new Date(
                        updatedIngredient.createdAt
                    ).toLocaleString(),
                    updatedAt: new Date(
                        updatedIngredient.updatedAt
                    ).toLocaleString(),
                }

                return transformResponse(
                    formattedReceipt,
                    'Receipt updated successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: receiptUpdateBody,
            detail: {
                tags: ['receipt'],
            },
        }
    )
    .delete(
        '/:storeId/receipt/:rptId',
        async ({ params: { rptId, storeId }, store: { db } }) => {
            try {
                const receipt = await db.receipt.findUnique({
                    where: { id: rptId },
                    select: {
                        ingredientIDs: true,
                        imageUrl: true,
                    },
                })

                if (receipt?.ingredientIDs.length) {
                    // Update ingredients to remove this receipt reference
                    await Promise.all(
                        receipt.ingredientIDs.map(async (ingredientId) => {
                            const ingredient = await db.ingredient.findUnique({
                                where: { id: ingredientId },
                                select: {
                                    receiptIDs: true,
                                    receiptInfo: true,
                                    quantity: true,
                                },
                            })

                            console.log(ingredient)

                            if (ingredient) {
                                const receiptInfo = ingredient.receiptInfo.find(
                                    (r) => r.receiptId === rptId
                                )

                                if (receiptInfo) {
                                    // Update quantity by subtracting unused portion
                                    let unusedQuantity = 0
                                    if (receiptInfo.isActive) {
                                        unusedQuantity =
                                            receiptInfo.quantity -
                                            receiptInfo.quantityUsed
                                    }

                                    // Remove receipt from receiptIDs
                                    const updatedReceiptIds =
                                        ingredient.receiptIDs.filter(
                                            (receiptId) => receiptId !== rptId
                                        )

                                    // Remove receipt from receiptInfo
                                    const updatedReceiptInfo =
                                        ingredient.receiptInfo.filter(
                                            (r) => r.receiptId !== rptId
                                        )

                                    await db.ingredient.update({
                                        where: { id: ingredientId },
                                        data: {
                                            quantity: {
                                                decrement: unusedQuantity,
                                            },
                                            receiptIDs: updatedReceiptIds,
                                            receiptInfo: updatedReceiptInfo,
                                        },
                                    })
                                }
                            }
                        })
                    )
                }

                // delete image from public
                if (receipt?.imageUrl) {
                    const publicPath = `public/${receipt.imageUrl}`
                    await Bun.file(publicPath).delete()
                    console.log('deleted image')
                }

                await db.receipt.delete({ where: { id: rptId } })

                return transformResponse(null, 'Receipt deleted successfully')
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['receipt'],
            },
        }
    )
    // order
    .get(
        '/:storeId/orders',
        async ({ store: { db }, query, params: { storeId } }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 99
            const skip = (page - 1) * limit

            const [orders, total] = await Promise.all([
                db.order.findMany({
                    where: storeId ? { storeId } : {},
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.order.count({ where: storeId ? { storeId } : {} }),
            ])

            return transformResponse(
                { orders, total },
                'Orders retrieved successfully'
            )
        },
        {
            detail: {
                tags: ['order'],
            },
        }
    )
    .get(
        '/:storeId/orders/:orderId',
        async ({ store: { db }, params: { storeId, orderId } }) => {
            const order = await db.order.findUnique({
                where: { id: orderId, storeId },
            })

            if (!order) {
                throw new Error('Product not found in specified store')
            }

            return transformResponse(order, 'Order retrieved successfully')
        },
        {
            detail: {
                tags: ['order'],
            },
        }
    )
    .patch(
        '/:storeId/orders/:orderId',
        async ({ store: { db }, body, params: { storeId, orderId } }) => {
            const order = await db.order.update({
                where: { id: orderId, storeId },
                data: body,
            })
            const storeLineBot = await db.store.findUnique({
                where: { id: storeId },
                select: {
                    lineOABot: true,
                },
            })
            if (!storeLineBot) {
                throw new Error('Store line bot not found')
            }
            let messageStatus: Message[] = []
            if (order.status === 'WAITING_DELIVERY') {
                messageStatus = [
                    {
                        type: 'text',
                        text: `ออเดอร์หมายเลข ${orderId}`,
                    },
                    {
                        type: 'textV2',
                        text: 'มีการอัพเดตสถานะเป็นรอจัดส่งแล้ว {s1}',
                        substitution: {
                            s1: {
                                type: 'emoji',
                                productId: '670e0cce840a8236ddd4ee4c',
                                emojiId: '112',
                            },
                        },
                    },
                ]
            } else if (order.status === 'IN_DELIVERY') {
                messageStatus = [
                    {
                        type: 'text',
                        text: `ออเดอร์หมายเลข ${orderId}`,
                    },
                    {
                        type: 'textV2',
                        text: 'มีการอัพเดตสถานะเป็นกำลังจัดส่งแล้ว {s1}',
                        substitution: {
                            s1: {
                                type: 'emoji',
                                productId: '670e0cce840a8236ddd4ee4c',
                                emojiId: '193',
                            },
                        },
                    },
                ]
            } else if (order.status === 'FINISHED') {
                messageStatus = [
                    {
                        type: 'text',
                        text: `ออเดอร์หมายเลข ${orderId}`,
                    },
                    {
                        type: 'textV2',
                        text: 'มีการอัพเดตสถานะเป็นสำเร็จแล้ว {s1}',
                        substitution: {
                            s1: {
                                type: 'emoji',
                                productId: '670e0cce840a8236ddd4ee4c',
                                emojiId: '073',
                            },
                        },
                    },
                ]
            }
            if (messageStatus.length > 0) {
                const response = await fetch(
                    'https://api.line.me/v2/bot/message/push',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${storeLineBot.lineOABot.channelAccessToken}`,
                        },
                        body: JSON.stringify({
                            to: order.customerLineId,
                            messages: messageStatus,
                        }),
                    }
                )
                console.log('send push message', response)
            }

            return transformResponse(order, 'Order updated successfully')
        },
        {
            body: t.Partial(orderCreateBody),
            detail: {
                tags: ['order'],
            },
        }
    )
    // .delete(
    //     '/:storeId/orders/:orderId',
    //     async ({ store: { db }, params: { storeId, orderId } }) => {
    //         await db.order.delete({ where: { id: orderId, storeId } })

    //         return transformResponse(null, 'Order deleted successfully')
    //     }
    // )

    // Transaction
    .get(
        '/:storeId/transactions',
        async ({ store: { db }, query, params: { storeId } }) => {
            const page = Number(query.page) || 1
            const limit = Number(query.limit) || 99
            const skip = (page - 1) * limit
            const storeOrder = await db.store.findUnique({
                where: { id: storeId },
                select: {
                    orders: {
                        select: {
                            id: true,
                            transaction: {
                                select: {
                                    slip: true,
                                    totalAmount: true,
                                    paymentMethod: true,
                                    orderId: true,
                                    createdAt: true,
                                    updatedAt: true,
                                    id: true,
                                    isConfirmed: true,
                                },
                            },
                        },
                    },
                },
            })

            const transactions = storeOrder?.orders.map(
                (order) => order.transaction
            )
            // fake page
            const total = transactions?.length || 0
            const pages = Math.ceil(total / limit)
            return transformResponse(
                { transactions, total, pages },
                'Transactions retrieved successfully'
            )
        },
        {
            detail: {
                tags: ['transaction'],
            },
        }
    )
    // patch trasaction by orderID
    .patch(
        '/:storeId/orders/:orderId/transactions',
        async ({ store: { db }, body, params: { storeId, orderId } }) => {
            const order = await db.order.findUnique({
                where: { id: orderId, storeId },
                include: {
                    transaction: true,
                },
            })

            if (!order) {
                throw new Error('Order not found')
            }

            if (!order.transaction) {
                throw new Error('Transaction not found')
            }

            const status = body.status

            if (status === 'confirmed') {
                const updatedTransaction = await db.transaction.update({
                    where: { id: order.transaction.id },
                    data: {
                        isConfirmed: true,
                    },
                })

                const updatedOrder = await db.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'WAITING_DELIVERY',
                    },
                })

                return transformResponse(
                    { updatedTransaction, updatedOrder },
                    'Transaction updated successfully'
                )
            }

            if (status === 'rejected') {
                const updatedTransaction = await db.transaction.update({
                    where: { id: order.transaction.id },
                    data: {
                        isConfirmed: false,
                        paymentMethod: 'REJECTED',
                    },
                })

                const updatedOrder = await db.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'CANCELLED',
                    },
                })

                return transformResponse(
                    { updatedTransaction, updatedOrder },
                    'Transaction updated successfully'
                )
            }
        },
        {
            body: t.Object({
                status: t.String({
                    enum: ['confirmed', 'rejected'],
                }),
            }),
            detail: {
                tags: ['transaction'],
            },
        }
    )

    .patch(
        '/:storeId/transactions/:transactionId',
        async ({ store: { db }, body, params: { storeId, transactionId } }) => {
            // const transaction = await db.transaction.update({
            //     where: { id: transactionId },
            //     data: body,
            // })

            return transformResponse(
                transaction,
                'Transaction updated successfully'
            )
        },
        {
            body: t.Partial(transactionUpdateBody),
            detail: {
                tags: ['transaction'],
            },
        }
    )

    // stats
    .get(
        '/:storeId/stats',
        async ({ store: { db }, params: { storeId } }) => {
            const stats = await db.order.findMany({
                where: { storeId, status: 'FINISHED' },
                include: {
                    transaction: true,
                },
            })
            if (!stats) {
                return transformResponse(null, 'Store stats not found')
            }
            console.log(stats)
            const summarize = {
                totalOrders: stats.length,
                totalSales: stats.reduce(
                    (acc, order) => acc + (order.transaction?.totalAmount || 0),
                    0
                ),
            }
            type ProductStats = {
                productId: string
                name: string
                totalSale: number
                totalOrders: number
            }

            const productMap = new Map<string, ProductStats>()

            for (const order of stats) {
                for (const product of order.productInfo) {
                    const key = product.productId

                    if (!productMap.has(key)) {
                        productMap.set(key, {
                            productId: product.productId,
                            name: product.name,
                            totalSale: 0,
                            totalOrders: 0,
                        })
                    }

                    const current = productMap.get(key)!
                    current.totalSale += (product.price || 0) * product.quantity
                    current.totalOrders += 1
                }
            }

            const productSummary = Array.from(productMap.values()).sort(
                (a, b) => b.totalOrders - a.totalOrders
            )

            const dailySales = stats.map((order) => ({
                date: order.transaction?.createdAt,
                totalSales: order.transaction?.totalAmount || 0,
                totalOrders: 1,
            }))
            return transformResponse(
                {
                    totalOrders: summarize.totalOrders,
                    totalSales: summarize.totalSales,
                    averageOrderValue:
                        summarize.totalSales / summarize.totalOrders,
                    productStats: productSummary,
                    dailySales,
                },
                'Store stats retrieved successfully'
            )
        },
        {
            detail: {
                tags: ['store'],
            },
        }
    )

    // API
    .post(
        '/:storeId/ocr',
        async ({ store: { db }, body, params: { storeId } }) => {
            try {
                // Save the uploaded image temporarily
                const fileExtension = body.image.name.split('.').pop()
                const fileName = `${storeId}.${fileExtension}`
                const publicPath = `public/ocr/${fileName}`

                const imageBuffer = await body.image
                    .arrayBuffer()
                    .then((buffer) => Buffer.from(buffer))

                const optimizedImageBuffer = await optimizeImage(imageBuffer)
                await Bun.write(Bun.file(publicPath), optimizedImageBuffer)

                // Process with Gemini
                const extractedData = await callGeminiImage(
                    optimizedImageBuffer
                )

                // Store metadata in database
                const imageRecord = {
                    path: publicPath,
                    extractedData,
                    createdAt: new Date(),
                }

                // Clean up the temporary file
                try {
                    await Bun.file(publicPath).delete()
                } catch (error) {
                    console.error('Failed to clean up temporary file:', error)
                }

                return transformResponse(
                    imageRecord,
                    'Receipt analyzed successfully'
                )
            } catch (error) {
                return transformError(error as Error)
            }
        },
        {
            body: t.Object({
                image: t.File({
                    maxSize: 2 * 1024 * 1024,
                    types: ['image/*'],
                }),
            }),
            detail: {
                tags: ['external'],
            },
        }
    )

// Optimize image for better OCR results
async function optimizeImage(imageBuffer: Buffer) {
    return await sharp(imageBuffer)
        .grayscale() // Convert to grayscale for better text recognition
        .normalize() // Normalize the image to improve contrast
        .sharpen() // Sharpen for better text clarity
        .withMetadata() // Preserve metadata
        .toBuffer()
}

// Worker cache to avoid recreating workers
const workerCache = new Map()

async function performOCR(imageBuffer: Buffer) {
    // Create a worker or reuse existing one
    let worker
    const cacheKey = 'eng+tha' // Using language as cache key

    if (workerCache.has(cacheKey)) {
        worker = workerCache.get(cacheKey)
    } else {
        worker = await createWorker('eng+tha', 1, {
            // logger: (m) => console.log(m),
        })
        await worker.setParameters({
            preserve_interword_spaces: '1',
            tessedit_char_blacklist: `'"`,
        })
        workerCache.set(cacheKey, worker)

        // Limit cache size to avoid memory issues
        if (workerCache.size > 3) {
            const oldestKey = workerCache.keys().next().value
            const oldWorker = workerCache.get(oldestKey)
            await oldWorker.terminate()
            workerCache.delete(oldestKey)
        }
    }

    try {
        const {
            data: { text, confidence },
        } = await worker.recognize(imageBuffer)
        // console.log('text:', cleanOcrText(text))
        // console.log('confidence:', confidence)
        return { text: cleanOcrText(text), confidence }
    } catch (error) {
        console.error('Tesseract recognition error:', error)
        throw new Error('Failed to recognize text from image')
    }
}

export function cleanOcrText(text: string) {
    if (!text) return ''

    const lines = text.split('\n')

    const processedLines = lines.map((line) => {
        if (!line.trim()) return ''

        let cleaned = line.replace(/[=\-—_|{}๐]/g, ' ')

        cleaned = cleaned.replace(/\s{2,}/g, ' ')

        const thaiVowels = [
            'ั',
            'ิ',
            'ี',
            'ึ',
            'ื',
            'ุ',
            'ู',
            'ํ',
            '่',
            '้',
            '๊',
            '๋',
            '็',
            '์',
        ]
        thaiVowels.forEach((vowel) => {
            cleaned = cleaned.replace(new RegExp(` ${vowel}`, 'g'), vowel)
        })

        cleaned = cleaned.replace(/([ก-๙]) ([ก-๙])/g, '$1$2')

        return cleaned.trim()
    })
    return processedLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// Clean up workers on shutdown
process.on('SIGINT', async () => {
    for (const worker of workerCache.values()) {
        await worker.terminate()
    }
    process.exit(0)
})

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// call LLM
const callGemini = async (text: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: `
You are an expert in Thai OCR receipt analysis, specializing in correcting garbled or unclear text. Your task is to accurately predict the correct Thai words and item descriptions, even when the input contains errors, missing characters, or typos. Use your knowledge of Thai language, common receipt items and pricing patterns to make informed corrections.

### Guidelines:
- Recognize and correct Thai text, such as "สโมกกี้พินเบคอน(หมู" to "สโมกกี้พันเบคอน (หมู)".
- For items with unclear descriptions you neet to provive low confidence score.
- Generate unit of item if it is not provided.

### Input Text:
${text}
`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    merchant_name: {
                        type: Type.STRING,
                        description: 'Name of the merchant',
                        nullable: false,
                    },
                    transaction_date: {
                        type: Type.STRING,
                        description:
                            'ISO 8601 date string of the transaction (e.g., 2025-03-07T13:07:00Z)',
                        nullable: false,
                    },
                    receipt_number: {
                        type: Type.STRING,
                        description: 'Receipt number',
                        nullable: false,
                    },
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: {
                                    type: Type.STRING,
                                    description: 'Description of the item',
                                    nullable: false,
                                },
                                quantity: {
                                    type: Type.NUMBER,
                                    description: 'Quantity of the item',
                                    nullable: false,
                                },
                                unit_price: {
                                    type: Type.NUMBER,
                                    description: 'Unit price of the item',
                                    nullable: false,
                                },
                                total_price: {
                                    type: Type.NUMBER,
                                    description: 'Total price of the item',
                                    nullable: false,
                                },
                                confidence: {
                                    type: Type.NUMBER,
                                    description: 'Confidence score of the item',
                                    nullable: false,
                                },
                                unit: {
                                    type: Type.STRING,
                                    description: 'Unit of the item',
                                    nullable: false,
                                },
                            },
                            required: [
                                'description',
                                'quantity',
                                'unit_price',
                                'total_price',
                                'confidence',
                                'unit',
                            ],
                        },
                    },
                },
                required: [
                    'merchant_name',
                    'transaction_date',
                    'receipt_number',
                    'items',
                ],
            },
        },
    })

    try {
        const parsedResult = JSON.parse(response.text || '{}')
        console.log(parsedResult)
        return parsedResult
    } catch (error) {
        return transformError(error as Error)
    }
}

const callGeminiImage = async (image: Buffer) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp-image-generation',
    })

    const generationConfig = {
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                merchant_name: {
                    type: Type.STRING,
                    description: 'Name of the merchant',
                    nullable: false,
                },
                transaction_date: {
                    type: Type.STRING,
                    description:
                        'ISO 8601 date string of the transaction (e.g., 2025-03-07T13:07:00Z)',
                    nullable: false,
                },
                receipt_number: {
                    type: Type.STRING,
                    description: 'Receipt number',
                    nullable: false,
                },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING, nullable: false },
                            quantity: { type: Type.NUMBER, nullable: false },
                            unit_price: { type: Type.NUMBER, nullable: false },
                            total_price: { type: Type.NUMBER, nullable: false },
                            confidence: { type: Type.NUMBER, nullable: false },
                            unit: { type: Type.STRING, nullable: false },
                        },
                        required: [
                            'description',
                            'quantity',
                            'unit_price',
                            'total_price',
                            'confidence',
                            'unit',
                        ],
                    },
                },
            },
            required: [
                'merchant_name',
                'transaction_date',
                'receipt_number',
                'items',
            ],
        },
    }

    const chatSession = model.startChat({
        generationConfig: generationConfig as any,
        history: [],
    })

    const result = await chatSession.sendMessage([
        {
            inlineData: {
                mimeType: 'image/png',
                data: image.toString('base64'),
            },
        },
        {
            text: `You are an expert in Thai OCR receipt analysis, specializing in correcting garbled or unclear text. Your task is to accurately predict the correct Thai words and item descriptions, even when the input contains errors, missing characters, or typos. Use your knowledge of Thai language, common receipt items and pricing patterns to make informed corrections.

            ### Guidelines:
            - Recognize and correct Thai text, such as "สโมกกี้พินเบคอน(หมู" to "สโมกกี้พันเบคอน (หมู)".
            - For items with unclear descriptions you neet to provive low confidence score.
            - Generate unit of item if it is not provided.`,
        },
    ])

    try {
        const parsedResult = JSON.parse(result.response.text() || '{}')
        return parsedResult
    } catch (error) {
        throw new Error('Failed to parse Gemini response')
    }
}

// Helper function to extract account information from OCR text
export function extractAccountInfo(
    text: string,
    accounts: Account[]
): {
    type: string
    value: string
    senderName?: string
    receiverName?: string
    receiverNameEn?: string
    amount?: number
} | null {
    // Clean up the text first
    text = text.replace(/\s+/g, ' ').trim()
    // Amount or จำนวนเงิน
    const amountMatch = text.match(
        /(?:Amount|จำนวนเงิน|จํานวนเงิน|Total|รวม)\s*([\d]+(?:\.\d+)?)/
    )
    // Extract amount
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined

    const {
        receiverType = '',
        receiverAccount = '',
        receiverBank = '',
        accountName = '',
        promptpayId = '',
        accountNameEn = '',
    } = findLongestMatch(text, accounts) || {}
    return {
        type: receiverType,
        value: receiverAccount,
        receiverName: accountName,
        receiverNameEn: accountNameEn,
        amount,
    }
}

function findLongestMatch(
    text: string,
    accounts: Account[]
): {
    receiverType: string
    receiverAccount: string
    receiverBank: string
    accountName: string
    promptpayId: string
    accountNameEn: string
} | null {
    let amountIndex =
        text.indexOf('Amount:') ||
        text.indexOf('จำนวนเงิน') ||
        text.indexOf('รวม') ||
        text.indexOf('Total')
    if (amountIndex === -1) return null // If no Amount found, return null

    let bestMatch = ''
    let bestMatchAccount: Account | null = null
    const searchText = text.toLowerCase()

    const bankPattern = /(([xX*0-9]+[0-9xX*])+)/

    for (const account of accounts) {
        for (const name of [
            account.accountNameTh.toLowerCase(),
            account.accountNameEn.toLowerCase(),
        ]) {
            console.log('find in', searchText, 'with name', name)
            const nameParts = name.split(' ')
            console.log('nameParts', nameParts)
            const nameWithLastName =
                nameParts[0] +
                ' ' +
                (nameParts.length > 1 ? nameParts[1][0] : '')
            if (
                searchText.includes(nameParts[0]) &&
                nameParts[0].length > bestMatch.length
            ) {
                bestMatch = nameParts[0]
                bestMatchAccount = account
            }
            if (
                searchText.includes(nameWithLastName) &&
                nameWithLastName.length > bestMatch.length
            ) {
                bestMatch = nameWithLastName
                bestMatchAccount = account
            }
        }
    }

    console.log('bestMatch', bestMatchAccount)

    return bestMatchAccount
        ? {
              receiverType: bestMatchAccount.receiverType || '',
              receiverAccount: bestMatchAccount.receiverAccount || '',
              receiverBank: bestMatchAccount.receiverBank || '',
              accountName: bestMatchAccount.accountNameTh || '', // The longest match found
              promptpayId: bestMatchAccount.promptpayId || '',
              accountNameEn: bestMatchAccount.accountNameEn || '',
          }
        : null
}
