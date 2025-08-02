import { Elysia, t } from 'elysia'
import { db } from '../lib/db'

enum Role {
    ADMIN,
    USER,
}

const LineUserProfile = t.Object({
    userId: t.String(),
    displayName: t.String(),
    statusMessage: t.Optional(t.String()),
    pictureUrl: t.Optional(t.String()),
})

type LineUserProfile = typeof LineUserProfile.static

const StoreProfile = t.Object({
    id: t.String(),
    // botId: t.Optional(t.String()),
})

type StoreProfile = typeof StoreProfile.static

enum OpeningStatus {
    OPEN = 'OPEN',
    OPEN_WITH_TIME = 'OPEN_WITH_TIME',
    CLOSE = 'CLOSE',
}

const openingHourSchema = t.Object({
    dayOfWeek: t.Enum({
        MONDAY: 'MONDAY',
        TUESDAY: 'TUESDAY',
        WEDNESDAY: 'WEDNESDAY',
        THURSDAY: 'THURSDAY',
        FRIDAY: 'FRIDAY',
        SATURDAY: 'SATURDAY',
        SUNDAY: 'SUNDAY',
    }),
    openingTime: t.Optional(t.String()),
    closingTime: t.Optional(t.String()),
    closed: t.Boolean(),
})

const accountSchema = t.Object({
    receiverType: t.String({ minLength: 1 }),
    receiverAccount: t.Any(),
    receiverBank: t.Any(),
    accountNameTh: t.String({ minLength: 1 }),
    accountNameEn: t.String({ minLength: 1 }),
    promptpayId: t.Any(),
})

const lineOABotSchema = t.Object({
    botId: t.String(),
    basicId: t.String(),
    displayName: t.String(),
    channelSecret: t.String({ minLength: 1 }),
    channelAccessToken: t.String({ minLength: 1 }),
})

const lineOABotUpdateBody = t.Object({
    channelSecret: t.String({ minLength: 1 }),
    channelAccessToken: t.String({ minLength: 1 }),
})

const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/

const storeRoleInfoSchema = t.Object({
    storeId: t.String(),
    role: t.Enum({
        OWNER: 'OWNER',
        STAFF: 'STAFF',
    }),
    assignedAt: t.String(),
})
type StoreRoleInfo = typeof storeRoleInfoSchema.static

const storeCreateBody = t.Object({
    storeName: t.String({ minLength: 1 }),
    phone: t.String({ pattern: phoneRegex.source }),
    address: t.String(),
    isCash: t.Boolean(),
    openingStatus: t.Enum(OpeningStatus),
    openingHours: t.Array(openingHourSchema),
    accounts: t.Array(accountSchema),
    lineOABot: lineOABotSchema,
})

type StoreCreateBody = typeof storeCreateBody.static

const storeUpdateBody = t.Object({
    storeName: t.Optional(t.String({ minLength: 1 })),
    phone: t.Optional(t.String({ pattern: phoneRegex.source })),
    address: t.Optional(t.String({ minLength: 1 })),
    isCash: t.Optional(t.Boolean()),
    openingStatus: t.Optional(t.Enum(OpeningStatus)),
    openingHours: t.Optional(t.Array(openingHourSchema)),
    accounts: t.Optional(t.Array(accountSchema)),
    lineOABot: t.Optional(lineOABotSchema),
    isDeleted: t.Optional(t.Boolean()),
    deletedAt: t.Optional(t.String()), // Nullable field for soft delete
})

type StoreUpdateBody = typeof storeUpdateBody.static

const ingredientInfoSchema = t.Object({
    ingredientId: t.String(),
    ingredientName: t.String({ minLength: 1 }),
    ingredientQuantity: t.Number({ minimum: 0 }),
    ingredientUnit: t.String({ minLength: 1 }),
})
export type IngredientInfo = typeof ingredientInfoSchema.static

const ingredientCreateBody = t.Object({
    name: t.String({ minLength: 1 }),
    // quantity: t.Number({ minimum: 0 }),
    unit: t.String({ minLength: 1 }),
})
export type IngredientCreate = typeof ingredientCreateBody.static

const ingredientUpdateBody = t.Partial(ingredientCreateBody)

const productCreateBody = t.Object({
    name: t.String({ minLength: 1 }),
    // imageUrl: t.Optional(t.String()),
    description: t.Optional(t.String()),
    price: t.String({
        validate: (value: string) => {
            const num = Number(value)
            if (isNaN(num)) return false // Ensure it's a valid number
            return num >= 0 // Enforce minimum value
        },
        transform: (value: string) => Number(value), // Convert string to number
    }),
    ingredientInfo: t.Optional(t.String()),
    ingredient: t.Optional(t.String()),
    image: t.Optional(
        t.File({
            maxSize: 2 * 1024 * 1024,
            types: ['image/png', 'image/jpg'],
        })
    ),
    isActive: t.Optional(t.String()),
})

type ProductCreateBody = typeof productCreateBody.static

const productUpdateBody = t.Partial(productCreateBody)
type ProductUpdateBody = typeof productUpdateBody.static

const receiptCreateBody = t.Object({
    imageUrl: t.Optional(t.String({ minLength: 1 })),
    store: t.String({ minLength: 1 }),
    receiptsRef: t.String({ minLength: 1 }),
    receiptsDate: t.String(),
    ingredients: t.Array(
        t.Intersect([
            ingredientCreateBody,
            t.Object({
                quantity: t.Number({ minimum: 0 }),
                ingId: t.String(),
                customUnit: t.Optional(t.String()),
                originalQuantity: t.Optional(t.Number()),
                products: t.Array(
                    t.Object({
                        pdId: t.String({ minLength: 1 }),
                        quantity: t.Number({ minimum: 0 }),
                        isEdit: t.Boolean(), // quantity is not edited or add new product to ingredient
                    })
                ),
                price: t.Number({ minimum: 0 }),
            }),
        ])
    ),
})
// const receiptUpdateBody
const receiptUpdateBody = t.Object({
    isActive: t.Boolean(),
})

type ReceiptUpdateBody = typeof receiptUpdateBody.static

const usedIngredientSchema = t.Object({
    ingredientId: t.String(),
    name: t.String(),
    quantity: t.Number(),
    price: t.Number(),
})

const orderCreateBody = t.Object({
    customerLineId: t.String(),
    customerName: t.String(),
    customerAdds: t.String(),
    productInfo: t.Array(
        t.Object({
            productId: t.String({ minLength: 1 }),
            name: t.String({ minLength: 1 }),
            quantity: t.Number({ minimum: 0 }),
            price: t.Number({ minimum: 0 }),
            customization: t.Optional(t.String()),
        })
    ),
    // productIDs: t.Array(t.String()),
    // usedIngredients: t.Array(usedIngredientSchema),
    status: t.String(),
})

const orderUpdateBody = t.Partial(orderCreateBody)

const transactionCreateBody = t.Object({
    slip: t.Optional(
        t.Object({
            transactionDate: t.String(),
            payload: t.String(),
            transRef: t.String(),
            senderName: t.String(),
            senderAccount: t.String(),
            senderBank: t.String(),
            receiverName: t.String(),
            receiverAccount: t.String(),
            receiverBank: t.String(),
            referenceNumber: t.String(),
            amount: t.Number(),
            qrcodeData: t.String(),
        })
    ),
    paymentMethod: t.Optional(t.String()),
    totalAmount: t.Number(),
    orderId: t.String(),
    createdAt: t.String(),
    updatedAt: t.String(),
})

type TransactionCreateBody = typeof transactionCreateBody.static

export interface SlipOkRequest {
    refNbr: string
    amount: string
}

export interface SlipOkSuccessResponse {
    success: true
    data: {
        success: boolean
        message: string
        language: string
        transRef: string
        sendingBank: string
        receivingBank: string
        transDate: string
        transTime: string
        transTimestamp: string
        sender: {
            displayName: string
            name: string
            proxy: {
                type: string | null
                value: string | null
            }
            account: {
                type: string
                value: string
            }
        }
        receiver: {
            displayName: string
            name: string
            proxy: {
                type: string
                value: string
            }
            account: {
                type: string
                value: string
            }
        }
        amount: number
        paidLocalAmount: number
        paidLocalCurrency: string
        countryCode: string
        transFeeAmount: number
        ref1: string
        ref2: string
        ref3: string
        toMerchantId: string
        qrcodeData: string
    }
}

export interface SlipOkErrorResponse {
    success: false
    code: number
    message: string
    data: SlipOkSuccessResponse['data']
}

export type SlipOkResponse = SlipOkSuccessResponse | SlipOkErrorResponse

export type VerificationResponse = {
    success: boolean
    data?: {
        success?: boolean
        message?: string
        statusMessage?: string
        receivingBank: string
        sendingBank: string
        transDate: string
        transTime: string
        sender: {
            displayName: string
            name: string
            account: {
                value: string
            }
        }
        receiver: {
            displayName: string
            name: string
            account: {
                value: string
            }
        }
        amount: number
    }
    msg?: string
    message?: string
    statusMessage?: string
}

const slipCreateBody = t.Object({
    success: t.Boolean(),
    statusMessage: t.String(),
    receivingBank: t.String(),
    sendingBank: t.String(),
    transDate: t.String(),
    transTime: t.String(),
    sender: t.Object({
        displayName: t.String(),
        name: t.String(),
        account: t.Object({
            value: t.String(),
        }),
    }),
    receiver: t.Object({
        displayName: t.String(),
        name: t.String(),
        account: t.Object({
            value: t.String(),
        }),
    }),
    amount: t.Number(),
    isConfirmed: t.Boolean(),
    createdAt: t.String(),
    updatedAt: t.String(),
    transactionId: t.String(),
})

type SlipCreateBody = typeof slipCreateBody.static

const transactionUpdateBody = t.Object({
    slip: t.Optional(t.Array(slipCreateBody)),
    paymentMethod: t.Optional(t.String()),
    totalAmount: t.Optional(t.Number()),
    isConfirmed: t.Optional(t.Boolean()),
    orderId: t.Optional(t.String()),
    updatedAt: t.Optional(t.String()),
})

type TransactionUpdateBody = typeof transactionUpdateBody.static

type Account = typeof accountSchema.static

export {
    LineUserProfile,
    StoreProfile,
    Role,
    OpeningStatus,
    storeCreateBody,
    StoreCreateBody,
    storeUpdateBody,
    StoreUpdateBody,
    accountSchema,
    lineOABotSchema,
    openingHourSchema,
    lineOABotUpdateBody,
    ProductCreateBody,
    productCreateBody,
    ProductUpdateBody,
    productUpdateBody,
    ingredientCreateBody,
    ingredientUpdateBody,
    receiptCreateBody,
    receiptUpdateBody,
    orderCreateBody,
    orderUpdateBody,
    ReceiptUpdateBody,
    transactionCreateBody,
    TransactionCreateBody,
    transactionUpdateBody,
    TransactionUpdateBody,
    slipCreateBody,
    SlipCreateBody,
    Account,
}
