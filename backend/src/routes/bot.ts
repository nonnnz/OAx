import { Elysia, t } from 'elysia'
import { transformResponse, transformError } from '../lib/utils'
import { db } from '../lib/db'
import {
    orderCreateBody,
    StoreProfile,
    SlipOkResponse,
    VerificationResponse,
} from '../types'
import { getUserData } from './user'
import { SlipOkService } from '../services/slipOkService'
import { optimizeImage, performOCR, extractAccountInfo } from '../lib/ocr'

const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY || ''
const slipOkService = new SlipOkService(SLIPOK_API_KEY)

export const lineBotAuth = new Elysia({ name: 'line/bot/auth' })
    .state({
        db: db,
        storeProfiles: {} as Record<string, StoreProfile>,
    })
    .onError(({ error }) => transformError(error as Error))
    .macro({
        validateBotId: () => ({
            beforeHandle: async ({ headers, error, store }) => {
                const authHeader = headers.authorization
                // console.log(authHeader)
                if (!authHeader?.startsWith('Bearer ')) {
                    return error(401, {
                        success: false,
                        message:
                            'Missing or invalid authorization header <Bearer token>',
                    })
                }

                const accessToken = authHeader.split(' ')[1]

                console.log('accessToken', accessToken)

                try {
                    const storeProfile = await db.store.findFirst({
                        where: {
                            lineOABot: {
                                is: {
                                    botId: accessToken,
                                },
                            },
                        },
                        select: {
                            id: true,
                            lineOABot: true,
                        },
                    })

                    store.storeProfiles[accessToken] = {
                        id: storeProfile?.id || '',
                    }
                } catch (err) {
                    return error(401, {
                        success: false,
                        message: 'Invalid Bot token',
                    })
                }
            },
        }),
    })
    .guard({
        as: 'scoped',
        validateBotId: true,
    })
    .resolve(async ({ headers, store }) => {
        const accessToken = headers.authorization!.split(' ')[1]
        return {
            storeId: store.storeProfiles[accessToken].id,
        }
    })
    .as('plugin')

export const botRoutes = new Elysia()
    .use(lineBotAuth)

    .get(
        '/',
        async ({ store: { db }, query, storeId }) => {
            return transformResponse({ storeId }, 'Reply from bot successfully')
        },
        {
            detail: {
                tags: ['bot'],
            },
        }
    )
    .get(
        '/store',
        async ({ store: { db }, storeId }) => {
            const store = await db.store.findUnique({ where: { id: storeId } })

            return transformResponse(store, 'Order retrieved successfully')
        },
        {
            detail: {
                tags: ['bot'],
            },
        }
    )
    .post(
        '/orders',
        async ({ store: { db }, body, storeId }) => {
            const {
                customerLineId,
                customerName,
                customerAdds,
                productInfo,
                status,
            } = body

            // console.log('productInfo', body)
            // return
            try {
                const productIDs = productInfo.map((p) => p.productId)
                // let totalAmount = 0
                // sum price for no ingredient product first
                let justProductPrice = 0
                let noIngredientPrice = 0

                const usedIngredients = await Promise.all(
                    productInfo.map(async (pd) => {
                        const product = (await db.product.findUnique({
                            where: { id: pd.productId },
                            select: {
                                ingredientInfo: true,
                                price: true,
                                name: true,
                            },
                        })) || { ingredientInfo: [], price: 0, name: '' }
                        // if (product.ingredientInfo.length === 0) {
                        //     noIngredientPrice += product.price * pd.quantity
                        // }
                        justProductPrice += product.price * pd.quantity
                        // totalAmount += product.price * pd.quantity
                        pd.name = product.name
                        pd.price = product.price
                        return product.ingredientInfo.map((i) => ({
                            ingredientId: i.ingredientId,
                            name: i.ingredientName,
                            quantity: i.ingredientQuantity * pd.quantity,
                            price: 0,
                        }))
                    })
                )

                console.log('usedIngredients', usedIngredients)

                interface Ingredient {
                    ingredientId: string
                    name: string
                    quantity: number
                    price: number
                }

                const summedIngredients = usedIngredients
                    .flat()
                    .reduce<Ingredient[]>((acc, curr) => {
                        const existingIngredient = acc.find(
                            (item) => item.ingredientId === curr.ingredientId
                        )

                        if (existingIngredient) {
                            existingIngredient.quantity += curr.quantity
                        } else {
                            acc.push({ ...curr })
                        }

                        return acc
                    }, [])

                console.log('summedIngredients', summedIngredients)

                console.log('productInfo', productInfo)
                // create empty order for receiptUsedOrder
                const intialOrder = await db.order.create({
                    data: {
                        storeId: storeId,
                        customerLineId,
                        customerName,
                        customerAdds,
                        productInfo: productInfo,
                        productIDs: productIDs,
                        usedIngredients: summedIngredients,
                        ingredientIDs: summedIngredients.map(
                            (i) => i.ingredientId
                        ),
                        status,
                    },
                })

                // const intialOrder = {
                //     productInfo: [
                //         {
                //             productId: '67e988da23abf6acbb4ee32f',
                //             name: 'กะเพราหมู',
                //             quantity: 4,
                //             price: 43,
                //             customization: '',
                //         },
                //     ],
                //     usedIngredients: [
                //         {
                //             ingredientId: '67e988da23abf6acbb4ee330',
                //             name: 'เนื้อหมู',
                //             quantity: 6,
                //             price: 0,
                //         },
                //     ],
                //     id: '67ea496b3a638203ebb891c8',
                //     storeId: '67bec698b9483827dcf0c05a',
                //     customerLineId: '67e988da23abf6acbb4ee32f',
                //     customerName: '67e988da23abf6acbb4ee32f',
                //     customerAdds: '67e988da23abf6acbb4ee32f',
                //     status: 'PENDING',
                //     productIDs: ['67e988da23abf6acbb4ee32f'],
                //     ingredientIDs: ['67e988da23abf6acbb4ee330'],
                //     createdAt: new Date(),
                //     updatedAt: new Date(),
                // }

                console.log('intialOrder', intialOrder)

                let ReceiptInfo = new Map<string, any[]>()

                let newPrice = 0
                // Cut inventory logic
                try {
                    await Promise.all(
                        summedIngredients.map(async (i) => {
                            const ingredient = await db.ingredient.findUnique({
                                where: { id: i.ingredientId },
                                select: {
                                    receiptInfo: true,
                                },
                            })

                            if (ingredient) {
                                let existingQuantity = i.quantity
                                ReceiptInfo.set(
                                    i.ingredientId,
                                    ingredient.receiptInfo.map((r) => {
                                        if (r.isActive) {
                                            console.log('r', r)
                                            let remainingQuantity =
                                                r.quantity - existingQuantity
                                            if (remainingQuantity <= 0) {
                                                r.isActive = false
                                                existingQuantity -= r.quantity
                                                r.quantityUsed += r.quantity
                                                newPrice += r.price * r.quantity
                                                r.receiptUsedOrder.push({
                                                    orderId: intialOrder.id,
                                                    quantity: existingQuantity,
                                                    price: r.price * r.quantity,
                                                })
                                            } else {
                                                r.quantityUsed +=
                                                    existingQuantity
                                                newPrice +=
                                                    r.price * existingQuantity
                                                r.receiptUsedOrder.push({
                                                    orderId: intialOrder.id,
                                                    quantity: existingQuantity,
                                                    price:
                                                        r.price *
                                                        existingQuantity,
                                                })
                                                existingQuantity = 0
                                            }

                                            console.log('newPrice: ', newPrice)
                                        }
                                        return r
                                    })
                                )
                                i.price = newPrice
                                if (existingQuantity > 0) {
                                    console.log(
                                        'existingQuantity: ',
                                        existingQuantity
                                    )
                                    console.log('not enough ingredient')
                                    // await db.order.update({
                                    //     where: { id: intialOrder.id },
                                    //     data: {
                                    //         status: 'CANCELLED',
                                    //     },
                                    // })
                                    throw new Error(
                                        `Not enough ingredient ${i.name} in ${
                                            productInfo.find(
                                                (p) =>
                                                    p.productId ===
                                                    i.ingredientId
                                            )?.name
                                        }`
                                    )
                                }
                            }
                        })
                    )
                } catch (err) {
                    console.log('err', err)
                    return transformError(err as Error)
                }

                console.log('ReceiptInfo: ', ReceiptInfo)
                console.log('newPrice: ', newPrice)
                // return

                // update ingredient
                summedIngredients.forEach(async (i) => {
                    await db.ingredient.update({
                        where: { id: i.ingredientId },
                        data: {
                            receiptInfo: ReceiptInfo.get(i.ingredientId),
                            quantity: {
                                decrement: i.quantity,
                            },
                        },
                    })
                })

                const order = await db.order.update({
                    where: { id: intialOrder.id },
                    data: {
                        usedIngredients: summedIngredients,
                    },
                })

                const transaction = await db.transaction.create({
                    data: {
                        orderId: order.id,
                        totalAmount: justProductPrice,
                    },
                })

                const orderWithTransaction = {
                    order,
                    transaction,
                }

                return transformResponse(
                    orderWithTransaction,
                    'Order created successfully'
                )
            } catch (err) {
                console.log('err', err)
                return transformResponse(null, 'Order created failed')
            }
        },
        {
            body: orderCreateBody,
            detail: {
                tags: ['bot'],
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

            return transformResponse(order, 'Order updated successfully')
        },
        {
            body: t.Partial(orderCreateBody),
            detail: {
                tags: ['bot'],
            },
        }
    )
    .delete(
        '/orders/:orderId',
        async ({ store: { db }, params: { orderId } }) => {
            try {
                // Get the order first to access its usedIngredients
                const order = await db.order.findUnique({
                    where: { id: orderId },
                    select: {
                        usedIngredients: true,
                    },
                })

                if (!order) {
                    throw new Error('Order not found')
                }

                // Revert inventory for each ingredient
                await Promise.all(
                    order.usedIngredients.map(async (ingredient) => {
                        const ingredientData = await db.ingredient.findUnique({
                            where: { id: ingredient.ingredientId },
                            select: { receiptInfo: true },
                        })

                        if (ingredientData) {
                            // Update receiptInfo to remove the order's usage
                            const updatedReceiptInfo =
                                ingredientData.receiptInfo.map((receipt) => {
                                    // Find and remove the order's entry from receiptUsedOrder
                                    const updatedReceiptUsedOrder =
                                        receipt.receiptUsedOrder.filter(
                                            (usedOrder) =>
                                                usedOrder.orderId !== orderId
                                        )

                                    // If the receipt was marked as inactive due to this order, reactivate it
                                    if (
                                        !receipt.isActive &&
                                        updatedReceiptUsedOrder.length <
                                            receipt.receiptUsedOrder.length
                                    ) {
                                        receipt.isActive = true
                                    }

                                    // Update the quantity used
                                    const removedOrder =
                                        receipt.receiptUsedOrder.find(
                                            (usedOrder) =>
                                                usedOrder.orderId === orderId
                                        )
                                    if (removedOrder) {
                                        receipt.quantityUsed -=
                                            removedOrder.quantity
                                    }

                                    return {
                                        ...receipt,
                                        receiptUsedOrder:
                                            updatedReceiptUsedOrder,
                                    }
                                })

                            // Update the ingredient with reverted inventory
                            await db.ingredient.update({
                                where: { id: ingredient.ingredientId },
                                data: { receiptInfo: updatedReceiptInfo },
                            })
                        }
                    })
                )

                // Delete the transaction first (due to foreign key constraint)
                await db.transaction.delete({
                    where: { orderId },
                })

                // Finally delete the order
                await db.order.delete({
                    where: { id: orderId },
                })

                return transformResponse(null, 'Order deleted successfully')
            } catch (error) {
                console.error('Error deleting order:', error)
                return transformError(error as Error)
            }
        },
        {
            detail: {
                tags: ['bot'],
            },
        }
    )

    // slip api
    .post(
        '/verify-slip/:transactionId',
        async ({ store: { db }, body, params: { transactionId } }) => {
            try {
                // get transaction and store details
                const transaction = await db.transaction.findUnique({
                    where: { id: transactionId },
                    include: {
                        order: {
                            include: {
                                store: true,
                            },
                        },
                        slip: true,
                    },
                })

                if (!transaction) {
                    throw new Error('Transaction not found')
                }

                // Validate request body
                if (!body.image) {
                    return transformError(
                        new Error('Image is required for verification')
                    )
                }

                // Save the uploaded image temporarily
                const fileExtension = body.image.name.split('.').pop()
                const fileName = `${transactionId}.${fileExtension}`
                const publicPath = `public/ocr/${fileName}`

                const imageBuffer = await body.image
                    .arrayBuffer()
                    .then((buffer) => Buffer.from(buffer))

                const optimizedImageBuffer = await optimizeImage(imageBuffer)
                await Bun.write(Bun.file(publicPath), optimizedImageBuffer)

                // // Process with Tesseract.js
                // const { text, confidence } = await performOCR(
                //     optimizedImageBuffer
                // )

                // console.log('text:', text, 'confidence:', confidence)
                // // const text = 'นาย รัชชานนท์ บัวชุม ratchanon buachum'

                // // Extract account information from OCR text
                // const accountInfo = extractAccountInfo(
                //     text,
                //     transaction.order.store.accounts
                // )
                // if (!accountInfo) {
                //     return transformError(
                //         new Error(
                //             'Could not extract account information from image'
                //         )
                //     )
                // }

                // console.log('accountInfo:', accountInfo)

                // // Validate amount if available
                // if (
                //     accountInfo.amount &&
                //     Math.abs(accountInfo.amount - transaction.totalAmount) >
                //         0.01
                // ) {
                //     return transformError(
                //         new Error(
                //             `Amount mismatch. Expected: ${
                //                 transaction.totalAmount
                //             }, Found: ${accountInfo.amount.toFixed(2)}`
                //         )
                //     )
                // }

                // // Check name
                // if (accountInfo.receiverName === '') {
                //     return transformError(
                //         new Error('Sender name does not match')
                //     )
                // }

                // transformResponse(accountInfo, 'Account found')

                const accountInfo = transaction.order.store.accounts

                // Verify with SlipOk
                const verificationResult = await slipOkService.verifySlip(
                    body.refNbr,
                    transaction.totalAmount.toString(),
                    transactionId
                )

                if (!verificationResult.success) {
                    return transformError(new Error('Slip verification failed'))
                }

                // Store the slip data
                const slipData = verificationResult.data
                console.log('slipData:', slipData)

                // verify again for error case
                let foundName = false
                for (const account of accountInfo) {
                    if (account.accountNameTh) {
                        if (slipData.receiver?.displayName) {
                            for (const namePart of slipData.receiver.displayName
                                .toLowerCase()
                                .split(' ')) {
                                if (
                                    account.accountNameTh
                                        .toLowerCase()
                                        .includes(namePart)
                                ) {
                                    foundName = true
                                    break
                                }
                                if (
                                    account.accountNameEn
                                        ?.toLowerCase()
                                        .includes(namePart)
                                ) {
                                    foundName = true
                                    break
                                }
                            }
                        }
                    }
                }

                if (!foundName) {
                    return transformError(
                        new Error('Sender name does not match')
                    )
                }

                // check if slip is duplicated
                if (slipData.transRef) {
                    const existingSlip = await db.slip.findFirst({
                        where: {
                            transRef: slipData.transRef,
                        },
                    })
                    if (existingSlip) {
                        return transformError(
                            new Error('Slip has already been verified')
                        )
                    }
                }

                // Create a new slip record
                const slip = await db.slip.create({
                    data: {
                        success: true,
                        statusMessage: slipData.message,
                        receivingBank: slipData.receivingBank,
                        sendingBank: slipData.sendingBank,
                        transDate: slipData.transDate,
                        transTime: slipData.transTime,
                        sender: {
                            displayName: slipData.sender.displayName,
                            name: slipData.sender.name,
                            account: {
                                value: slipData.sender.account.value,
                            },
                        },
                        receiver: {
                            displayName: slipData.receiver?.displayName || '',
                            name: slipData.receiver?.name || '',
                            account: {
                                value: slipData.receiver?.account?.value || '',
                            },
                        },
                        amount: slipData.amount,
                        isConfirmed: true,
                        transactionId: transaction.id,
                        transRef: slipData.transRef,
                        qrcodeData: slipData?.qrcodeData || '',
                    },
                })

                // Update transaction status
                await db.transaction.update({
                    where: { id: transactionId },
                    data: {
                        isConfirmed: true,
                        paymentMethod: accountInfo.type,
                        slip: {
                            connect: {
                                id: slip.id,
                            },
                        },
                    },
                })

                // update order status
                await db.order.update({
                    where: { id: transaction.order.id },
                    data: {
                        status: 'WAITING_DELIVERY',
                    },
                })

                // Clean up the temporary file
                try {
                    await Bun.file(publicPath).delete()
                } catch (error) {
                    console.error('Failed to clean up temporary file:', error)
                }

                return transformResponse(
                    { slip, transaction },
                    'Slip verified successfully'
                )
            } catch (error) {
                console.error('Error verifying slip:', error)
                return transformError(error as Error)
            }
        },
        {
            body: t.Object({
                refNbr: t.String({
                    minLength: 10,
                    error: 'Reference number is required and must be at least 10 characters',
                }),
                image: t.File({
                    maxSize: 2 * 1024 * 1024,
                    types: ['image/*'],
                }),
            }),
            detail: {
                tags: ['bot'],
                summary: 'Verify a payment slip',
                description: 'Verifies a payment slip using SlipOk API',
            },
        }
    )

    // cash payment
    .post(
        '/cash-payment/:transactionId',
        async ({ store: { db }, params: { transactionId } }) => {
            console.log('cash payment', transactionId)
            const transaction = await db.transaction.findUnique({
                where: { id: transactionId },
                include: {
                    order: true,
                },
            })

            if (!transaction) {
                throw new Error('Transaction not found')
            }

            // Update transaction status
            await db.transaction.update({
                where: { id: transactionId },
                data: {
                    isConfirmed: false,
                    paymentMethod: 'CASH',
                },
            })

            return transformResponse(transaction, 'Cash payment confirmed')
        },
        {
            detail: {
                tags: ['bot'],
            },
        }
    )
