import { Elysia, t } from 'elysia'
import * as line from '@line/bot-sdk'
import { db } from '../lib/db'
import * as crypto from 'crypto'
import axios from 'axios'
import { OpenAI } from 'openai'
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources'
import { profile } from 'console'
import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { transformResponse } from '../lib/utils'
import type { Message } from '@line/bot-sdk/dist/messaging-api/model/message'
import type { MessageAction } from '@line/bot-sdk/dist/messaging-api/model/messageAction'
import type { FlexMessage } from '@line/bot-sdk/dist/messaging-api/model/flexMessage'
import type { FlexBubble } from '@line/bot-sdk/dist/messaging-api/model/flexBubble'
import type { FlexBox } from '@line/bot-sdk/dist/messaging-api/model/flexBox'
import type { FlexComponent } from '@line/bot-sdk/dist/messaging-api/model/flexComponent'
import type { FlexImage } from '@line/bot-sdk/dist/messaging-api/model/flexImage'
import type { ReplyMessageRequest } from '@line/bot-sdk/dist/messaging-api/model/replyMessageRequest'
import { TemplateMessage } from '@line/bot-sdk/dist/messaging-api/model/templateMessage'
import util from 'util'
import { pipeline } from 'stream'
import fs from 'fs'

import { allocUnsafe } from 'bun'
import redis from '../lib/redis'
import { performOCR, optimizeImage } from '../lib/ocr'
import jsQR from 'jsqr'
import { loadImage } from 'canvas'
import { createCanvas } from 'canvas'
import { console } from 'inspector'
// import { StoreProfile } from '../types'

// Add type definitions at the top of the file
type BotResponse = {
    success?: boolean
    error?: {
        message: string
    }
    data?: {
        message?: string
        order?: {
            id: string
            customerName: string
            customerAdds: string
            productInfo: Array<{
                name: string
                quantity: number
                customization?: string
            }>
            status: string
            usedIngredients: Array<{ name: string; quantity: number }>
        }
        transaction?: {
            slip: string | null
            id: string
            slipId: string | null
            totalAmount: number
            paymentMethod: string | null
            orderId: string
            createdAt: string
            updatedAt: string
        }
    }
    transaction?: {
        slip: string | null
        id: string
        slipId: string | null
        totalAmount: number
        paymentMethod: string | null
        orderId: string
        createdAt: string
        updatedAt: string
    }
}

// Update FlexMessageSchema to match LINE Bot SDK types

// console.log(process.env.CLOUD_RUN_OLLAMA_URL)
// AI Provider Configurations
type AIProvider = {
    name: string
    baseURL: string
    apiKey: string
    models: string[]
}

const aiProviders: AIProvider[] = [
    {
        name: 'Ollama',
        baseURL:
            process.env.CLOUD_RUN_OLLAMA_URL || 'http://localhost:11434/v1',
        apiKey: 'ollama',
        models: [
            'scb10x/llama3.2-typhoon2-t1-3b-research-preview:latest',
            'scb10x/llama3.2-typhoon2-3b-instruct:latest',
            'qwen3:4b',
        ],
    },
    {
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1/',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        models: [
            'anthropic/claude-3-opus-20240229',
            'anthropic/claude-3-sonnet-20240229',
            'google/gemini-pro',
        ],
    },
]

let currentProviderIndex = 0
let currentModelIndex = 2

export const lineCallbackPlugin = new Elysia()
    .state({
        clients: {} as Record<string, line.messagingApi.MessagingApiClient>,
        blobClients: {} as Record<
            string,
            line.messagingApi.MessagingApiBlobClient
        >,
        // StoreProfiles: {} as Record<string, StoreProfile>,
    })
    .model({
        lineEvent: t.Object({
            type: t.String(),
            originalContentUrl: t.Optional(t.String()),
            previewImageUrl: t.Optional(t.String()),
            message: t.Optional(
                t.Object({
                    type: t.String(),
                    text: t.Optional(t.String()),
                    originalContentUrl: t.Optional(t.String()),
                    previewImageUrl: t.Optional(t.String()),
                    id: t.Optional(t.String()),
                    quoteToken: t.Optional(t.String()),
                    contentProvider: t.Optional(
                        t.Object({
                            type: t.String(),
                        })
                    ),
                })
            ),
            replyToken: t.Optional(t.String()),
            source: t.Optional(
                t.Object({
                    type: t.String(),
                    userId: t.Optional(t.String()),
                })
            ),
            label: t.Optional(t.String()),
            data: t.Optional(t.String()),
            displayText: t.Optional(t.String()),
            inputOption: t.Optional(t.String()),
            fillInText: t.Optional(t.String()),
            mode: t.Optional(t.String()),
            timestamp: t.Optional(t.Number()),
            webhookEventId: t.Optional(t.String()),
            deliveryContext: t.Optional(
                t.Object({
                    isRedelivery: t.Optional(t.Boolean()),
                })
            ),
            postback: t.Optional(
                t.Object({
                    data: t.Optional(t.String()),
                    params: t.Optional(
                        t.Object({
                            newRichMenuAliasId: t.Optional(t.String()),
                            status: t.Optional(t.String()),
                        })
                    ),
                })
            ),
        }),
        lineWebhookBody: t.Object({
            events: t.Array(t.Ref('lineEvent')),
        }),
    })
    .onParse(async ({ request, headers }) => {
        // Only modify parsing for Line webhook endpoints
        if (request.url.includes('/callback/')) {
            const arrayBuffer = await Bun.readableStreamToArrayBuffer(
                request.body!
            )
            const rawBody = Buffer.from(arrayBuffer)
            console.log('request:', request)

            // Store the rawBody for later verification
            // @ts-ignore - adding property to request object
            request.rawBody = rawBody

            // Still return the parsed JSON for route handler
            return JSON.parse(rawBody.toString())
        }
    })
    .post(
        '/callback/:id',
        async ({ params, body, request, set, store }) => {
            try {
                // console.log('body.events:', body.events)
                const lineConfig = await db.store.findUnique({
                    where: { id: params.id },
                    select: {
                        lineOABot: true,
                        products: true,
                        accounts: true,
                        storeName: true,
                        isCash: true,
                        phone: true,
                        address: true,
                    },
                })

                if (!lineConfig) {
                    set.status = 404
                    return {
                        success: false,
                        message: 'Line configuration not found',
                    }
                }

                const storeProfile = {
                    id: params.id,
                    botId: lineConfig.lineOABot.botId,
                    product: lineConfig.products,
                    accounts: lineConfig.accounts,
                    storeName: lineConfig.storeName,
                    isCash: lineConfig.isCash,
                    phone: lineConfig.phone,
                    address: lineConfig.address,
                }
                // console.log('storeProfile', storeProfile)

                const channelAccessToken =
                    lineConfig.lineOABot?.channelAccessToken
                const channelSecret = lineConfig.lineOABot?.channelSecret

                const signature = request.headers.get('x-line-signature')

                if (!signature) {
                    set.status = 401
                    return {
                        success: false,
                        message: 'Missing signature',
                    }
                }

                // @ts-ignore - get the stored rawBody from request
                const rawBody = request.rawBody
                const hmac = crypto.createHmac('SHA256', channelSecret)
                const digest = hmac.update(rawBody).digest('base64')

                console.log('Line callback:', body)
                console.log('Line signature:', signature)
                console.log('Line digest:', digest)

                if (digest !== signature) {
                    console.log('Signature verification failed')
                    set.status = 401
                    return {
                        success: false,
                        message: 'Invalid signature',
                    }
                }

                if (!store.clients[params.id]) {
                    store.clients[params.id] =
                        new line.messagingApi.MessagingApiClient({
                            channelAccessToken,
                        })
                }
                if (!store.blobClients[params.id]) {
                    store.blobClients[params.id] =
                        new line.messagingApi.MessagingApiBlobClient({
                            channelAccessToken,
                        })
                }
                const client = store.clients[params.id]
                const blobClient = store.blobClients[params.id]

                const results = await Promise.all(
                    body.events.map((event) =>
                        handleEvent(event, client, blobClient, storeProfile)
                    )
                )

                return {
                    success: true,
                    results,
                }
            } catch (error) {
                console.error('Line callback error:', error)
                set.status = 500
                return {
                    success: false,
                    message: 'Internal server error',
                }
            }
        },
        {
            body: 'lineWebhookBody',
            detail: {
                tags: ['line'],
            },
        }
    )

// Update ConversationState type to include cart functionality
type ConversationState = {
    userId: string
    storeId: string
    isBotEnabled: boolean
    orderType: 'new' | 'edit' | 'cart'
    currentOrder?: {
        items: Array<{
            name: string
            quantity: number
            customization: string
            price: number
        }>
        deliveryAddress?: string
        orderId?: string
        customerName?: string
    }
    lastInteraction: Date
    expiresAt: Date | string // Allow both Date and string for flexibility
}

// Add conversation key generator
function getConversationKey(userId: string, storeId: string): string {
    return `conversation:${userId}:${storeId}`
}

// Add response key generator
function getResponseKey(userId: string): string {
    return `response:${userId}`
}

// Add conversation state management functions
async function getConversationState(
    userId: string,
    storeId: string
): Promise<ConversationState | undefined> {
    const key = getConversationKey(userId, storeId)
    const data = await redis.get(key)
    if (!data) return undefined
    return JSON.parse(data)
}

async function setConversationState(state: ConversationState) {
    const key = getConversationKey(state.userId, state.storeId)
    // Ensure expiresAt is a Date object
    const expiresAt =
        state.expiresAt instanceof Date
            ? state.expiresAt
            : new Date(state.expiresAt)
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    await redis.setex(key, ttl, JSON.stringify(state))
}

async function clearConversationState(userId: string, storeId: string) {
    const key = getConversationKey(userId, storeId)
    await redis.del(key)
}

// Add response state management functions
async function getResponseState(
    userId: string
): Promise<BotResponse | undefined> {
    const key = getResponseKey(userId)
    const data = await redis.get(key)
    if (!data) return undefined
    return JSON.parse(data)
}

async function setResponseState(userId: string, response: BotResponse) {
    const key = getResponseKey(userId)
    // Store response for 1 hour
    await redis.setex(key, 3600, JSON.stringify(response))
}

async function clearResponseState(userId: string) {
    const key = getResponseKey(userId)
    await redis.del(key)
}

// Add message types
// type TextMessage = {
//     type: 'text'
//     text: string
// }

// type ImageMessage = {
//     type: 'image'
//     originalContentUrl: string
//     previewImageUrl: string
// }

// type MessageSchema =
//     | TextMessage
//     | ImageMessage
//     | FlexMessageSchema
//     | MessageAction
/*        type: t.String(),
            message: t.Optional(
                t.Object({
                    type: t.String(),
                    text: t.Optional(t.String()),
                })
            ),
            replyToken: t.Optional(t.String()),
            source: t.Optional(
                t.Object({
                    type: t.String(),
                    userId: t.Optional(t.String()),
                })
            ),
            label: t.Optional(t.String()),
            data: t.Optional(t.String()),
            displayText: t.Optional(t.String()),
            inputOption: t.Optional(t.String()),
            fillInText: t.Optional(t.String()),
            mode: t.Optional(t.String()),
            timestamp: t.Optional(t.Number()),
            webhookEventId: t.Optional(t.String()),
            deliveryContext: t.Optional(
                t.Object({
                    isRedelivery: t.Optional(t.Boolean()),
                })
            ),
            postback: t.Optional(
                t.Object({
                    data: t.Optional(t.String()),
                    params: t.Optional(
                        t.Object({
                            newRichMenuAliasId: t.Optional(t.String()),
                            status: t.Optional(t.String()),
                        })
                    ),
                })
            ),
        }),*/

// Update event type definition
type LineEvent = {
    type: string
    message?: {
        type: string
        text?: string
        id?: string
        quoteToken?: string
        contentProvider?: { type: string }
        originalContentUrl?: string
        previewImageUrl?: string
    }
    replyToken?: string
    source?: { type: string; userId?: string }
    profile?: any
    postback?: {
        data?: string
        params?: { newRichMenuAliasId?: string; status?: string }
    }
}

// Modify handleEvent to use the new type
async function handleEvent(
    event: LineEvent,
    client: line.messagingApi.MessagingApiClient,
    blobClient: line.messagingApi.MessagingApiBlobClient,
    storeProfile: any
) {
    const profile = await client.getProfile(event.source?.userId || '')
    event = { ...event, profile }
    console.log('added profile to event:', event)
    // console.log('from handleEvent:', event)
    // Get or create conversation state
    let conversationState = await getConversationState(
        event.source?.userId || '',
        storeProfile.id || ''
    )
    if (!conversationState) {
        conversationState = {
            userId: event.source?.userId || '',
            storeId: storeProfile.id,
            isBotEnabled: true,
            orderType: 'new',
            lastInteraction: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes TTL
        }
    }

    // USER GUIDE
    const guideMessage: Message = {
        type: 'textV2',
        text: 'สามารถสั่งอาหารต่อ {sticker1}\nหรือเลือกคำสั่งลัดต่อไปนี้ {sticker2}',
        substitution: {
            sticker1: {
                type: 'emoji',
                productId: '670e0cce840a8236ddd4ee4c',
                emojiId: '134',
            },
            sticker2: {
                type: 'emoji',
                productId: '670e0cce840a8236ddd4ee4c',
                emojiId: '073',
            },
        },
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=guide',
                        label: 'ตัวอย่างการใช้งาน 💡',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=product_list',
                        label: 'สินค้าทั้งหมด 🍴',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=close_bot',
                        label: 'ปิดการใช้งานบอท 🤖',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=contract_admin',
                        label: 'ติดต่อแอดมิน 📲',
                    },
                },
            ],
        },
    }

    const guideQuickReply: Message = {
        type: 'textV2',
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=guide',
                        label: 'ตัวอย่างการใช้งาน 💡',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=product_list',
                        label: 'สินค้าทั้งหมด 🍴',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=close_bot',
                        label: 'ปิดการใช้งานบอท 🤖',
                    },
                },
                {
                    type: 'action',
                    action: {
                        type: 'postback',
                        data: 'action=contract_admin',
                        label: 'ติดต่อแอดมิน 📲',
                    },
                },
            ],
        },
    }

    // ENABLE BOT
    const enableBotMessage: FlexMessage = {
        type: 'flex',
        altText: 'ตัวอย่างการใช้งาน',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        action: {
                            type: 'postback',
                            data: 'action=enable_bot',
                            label: 'เปิดใช้งานบอท 🤖',
                        },
                    },
                ],
            },
        },
    }

    // Update last interaction
    conversationState.lastInteraction = new Date()
    conversationState.expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    console.log('conversationState:', conversationState)
    // Handle postback events
    if (event.type === 'postback' && event.postback?.data) {
        const [action, actionId] = event.postback.data
            .split('&')
            .map((param) => {
                const [key, value] = param.split('=')
                return value
            })
        console.log('action:', action)
        console.log('actionId:', actionId)
        switch (action) {
            case 'select_product':
                // add product to cart
                await place_order(
                    {
                        items: [
                            {
                                name: storeProfile.product[actionId].name,
                                quantity: 1,
                                customization: '',
                            },
                        ],
                        delivery_address:
                            conversationState?.currentOrder?.deliveryAddress ||
                            '',
                    },
                    event,
                    storeProfile
                )
                const placeConversationState_show = await getConversationState(
                    event.source?.userId || '',
                    storeProfile.id
                )
                console.log(
                    'placeConversationState_show:',
                    placeConversationState_show
                )
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'สินค้าเพิ่มลงตะกร้าเรียบร้อยแล้วครับ',
                        },
                        createCartFlexMessage(
                            placeConversationState_show?.currentOrder || [],
                            storeProfile
                        ),
                    ],
                })
            case 'product_list':
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        createStoreProductListCarousel(
                            storeProfile
                        ) as TemplateMessage,
                        guideMessage,
                    ],
                })
            case 'cash':
                // Get the response state to get transaction ID
                const responseState = await getResponseState(
                    event.source?.userId || ''
                )
                if (!responseState?.transaction?.id) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'ไม่พบข้อมูลการทำรายการ กรุณาสั่งซื้อใหม่',
                            },
                            guideMessage,
                        ],
                    })
                }
                await axios.post(
                    `${process.env.BACKEND_URL}/api/v1/bot/cash-payment/${responseState.transaction.id}`,
                    {},
                    {
                        headers: {
                            authorization: `Bearer ${storeProfile.botId}`,
                            'Content-Type': 'application/json',
                        },
                    }
                )

                // Clear response state after successful verification
                await clearResponseState(event.source?.userId || '')
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'เลือกเป็นชำระเงินด้วยเงินสดเรียบร้อยแล้วครับ',
                        },
                        {
                            type: 'text',
                            text: 'กรุณารอระบบยืนยันการชำระเงิน',
                        },
                    ],
                })

            case 'select_account':
                // Handle selecting account
                const account = storeProfile.accounts[actionId]
                if (account.receiverType === 'PROMPTPAY') {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            createPaymentMessages(
                                account,
                                (await getResponseState(
                                    event.source?.userId || ''
                                )) as BotResponse
                            ) as FlexMessage,
                        ],
                    })
                } else {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            createBankAccountMessages(
                                account,
                                (await getResponseState(
                                    event.source?.userId || ''
                                )) as BotResponse
                            ) as FlexMessage,
                            {
                                type: 'template',
                                altText: 'Bank Account code',
                                template: {
                                    type: 'buttons',
                                    text: 'คัดลอกหมายเลขบัญชี',
                                    actions: [
                                        {
                                            type: 'clipboard',
                                            label: 'Copy Bank Account',
                                            clipboardText:
                                                account.receiverAccount,
                                        },
                                    ],
                                },
                            },
                        ],
                    })
                }
                console.log('account:', account)
                break
            case 'add':
                // Handle adding items to cart
                conversationState.orderType = 'cart'
                conversationState.currentOrder = {
                    orderId: actionId,
                    items: [],
                    deliveryAddress: '',
                }
                await setConversationState(conversationState)
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'กรุณาระบุสินค้าที่ต้องการเพิ่มครับ',
                        },
                    ],
                })

            case 'confirm':
                const checkResponse = await getResponseState(
                    event.source?.userId || ''
                )
                if (checkResponse) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'โปรดชำระเงิน หรือยกเลิกคำสั่งซื้อก่อนหน้านี้',
                            },
                        ],
                    })
                }
                // Handle order confirmation
                if (conversationState.currentOrder && event.source?.userId) {
                    // Case that improtant information is missing
                    if (!conversationState.currentOrder.deliveryAddress) {
                        return client.replyMessage({
                            replyToken: event.replyToken!,
                            messages: [
                                {
                                    type: 'textV2',
                                    text: 'กรุณาใส่ที่อยู่จัดส่งก่อนยืนยันคำสั่งซื้อครับ {sticker1}',
                                    substitution: {
                                        sticker1: {
                                            type: 'emoji',
                                            productId:
                                                '670e0cce840a8236ddd4ee4c',
                                            emojiId: '130',
                                        },
                                    },
                                },
                            ],
                        })
                    }
                    // Create order directly from conversation state
                    const orderDetails = {
                        customerLineId: event.source.userId,
                        customerName:
                            conversationState.currentOrder.customerName,
                        customerAdds:
                            conversationState.currentOrder.deliveryAddress ||
                            '',
                        productInfo: conversationState.currentOrder.items
                            .map((item: any) => {
                                const product = storeProfile.product.find(
                                    (p: any) => p.name === item.name
                                )
                                if (product) {
                                    return {
                                        productId: product.id,
                                        name: product.name,
                                        quantity: item.quantity,
                                        price: product.price,
                                        customization: item.customization || '',
                                    }
                                }
                                return null
                            })
                            .filter((item: any) => item !== null),
                        status: 'PENDING',
                    }

                    try {
                        console.log('orderDetails:', orderDetails)
                        clearConversationState(
                            event.source?.userId || '',
                            storeProfile.id
                        )
                        // return
                        const response = await axios.post(
                            `${process.env.BACKEND_URL}/api/v1/bot/orders`,
                            orderDetails,
                            {
                                headers: {
                                    authorization: `Bearer ${storeProfile.botId}`,
                                    'Content-Type': 'application/json',
                                },
                            }
                        )
                        // const response = {
                        //     data: {
                        //         success: true,
                        //         data: {
                        //             order: {
                        //                 productInfo: [
                        //                     {
                        //                         productId:
                        //                             '67e988da23abf6acbb4ee32f',
                        //                         name: 'กะเพราหมู',
                        //                         quantity: 3,
                        //                         price: 43,
                        //                         customization: '',
                        //                     },
                        //                     {
                        //                         productId:
                        //                             '67c57265ddd44d3be965dc84',
                        //                         name: 'ไก่สับ',
                        //                         quantity: 5,
                        //                         price: 30,
                        //                         customization: '',
                        //                     },
                        //                 ],
                        //                 usedIngredients: [
                        //                     {
                        //                         ingredientId:
                        //                             '67e988da23abf6acbb4ee330',
                        //                         name: 'เนื้อหมู',
                        //                         quantity: 4.5,
                        //                         price: 675,
                        //                     },
                        //                     {
                        //                         ingredientId:
                        //                             '67c57265ddd44d3be965dc85',
                        //                         name: 'เนื้อไก่',
                        //                         quantity: 5,
                        //                         price: 1185,
                        //                     },
                        //                 ],
                        //                 id: '67ea7dd7a9f10e17e491a1b8',
                        //                 storeId: '67bec698b9483827dcf0c05a',
                        //                 customerLineId:
                        //                     'Ua4439b0611353c66c91bf153e3e28046',
                        //                 customerName: 'Ratchanon B.',
                        //                 customerAdds: '123 ถนนสุขุมวิถี กทม.',
                        //                 status: 'PENDING',
                        //                 productIDs: [
                        //                     '67e988da23abf6acbb4ee32f',
                        //                     '67c57265ddd44d3be965dc84',
                        //                 ],
                        //                 ingredientIDs: [
                        //                     '67e988da23abf6acbb4ee330',
                        //                     '67c57265ddd44d3be965dc85',
                        //                 ],
                        //                 createdAt: '2025-03-31T11:34:47.081Z',
                        //                 updatedAt: '2025-03-31T11:34:47.097Z',
                        //             },
                        //             transaction: {
                        //                 slip: null,
                        //                 id: '67ea7dd7a9f10e17e491a1b9',
                        //                 slipId: null,
                        //                 totalAmount: 1185,
                        //                 paymentMethod: null,
                        //                 orderId: '67ea7dd7a9f10e17e491a1b8',
                        //                 createdAt: '2025-03-31T11:34:47.104Z',
                        //                 updatedAt: '2025-03-31T11:34:47.104Z',
                        //             },
                        //         },
                        //         message: 'Order created successfully',
                        //         timestamp: '3/31/2025, 6:34:47 PM',
                        //     },
                        // }
                        console.log('response:', response.data)
                        if (response.data) {
                            await setResponseState(
                                event.source?.userId || '',
                                response.data.data as BotResponse
                            )
                            clearConversationState(
                                event.source?.userId || '',
                                storeProfile.id
                            )
                            const allMessages: Message[] = [
                                {
                                    type: 'text',
                                    text: 'ยืนยันคำสั่งซื้อเรียบร้อยแล้วครับ',
                                },
                                createOrderFlexMessage(
                                    response.data.data,
                                    storeProfile,
                                    response.data.data.order.productInfo.map(
                                        (item: any) => ({
                                            summary:
                                                item.name +
                                                ' x' +
                                                item.quantity +
                                                ' ' +
                                                (item.customization
                                                    ? item.customization
                                                    : ''),
                                            price: item.price,
                                        })
                                    ),
                                    response.data.data.order.customerName,
                                    conversationState.currentOrder
                                        ?.deliveryAddress || '',
                                    response.data.data.order.productInfo.reduce(
                                        (acc: number, item: any) =>
                                            acc + item.quantity,
                                        0
                                    )
                                ),
                            ]
                            // find first promptpayId
                            // const promptpayProfile = storeProfile.accounts.find(
                            //     (i: any) => i.receiverType === 'PROMPTPAY'
                            // )
                            // if (promptpayProfile) {
                            //     allMessages.push(
                            //         createPaymentMessages(
                            //             promptpayProfile,
                            //             response.data.data
                            //         ) as FlexMessage
                            //     )
                            // }

                            allMessages.push(
                                createCarouselAccount(
                                    storeProfile.accounts
                                ) as TemplateMessage
                            )
                            if (storeProfile.isCash) {
                                allMessages.push({
                                    type: 'textV2',
                                    text: 'โปรดชำระเงินด้วยตัวเลือกต่อไปนี้',
                                    quickReply: {
                                        items: [
                                            {
                                                type: 'action',
                                                action: {
                                                    type: 'postback',
                                                    data: 'action=cash',
                                                    label: 'ชำระด้วยเงินสด 💵',
                                                },
                                            },
                                        ],
                                    },
                                })
                            }

                            return client.replyMessage({
                                replyToken: event.replyToken!,
                                messages: allMessages,
                            })
                        }
                    } catch (error: any) {
                        console.error('API Error:', error)
                        return client.replyMessage({
                            replyToken: event.replyToken!,
                            messages: [
                                {
                                    type: 'text',
                                    text: 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง',
                                },
                            ],
                        })
                    }
                }
                break

            case 'cancel':
                if (actionId) {
                    // call delete order
                    clearResponseState(event.source?.userId || '')
                    const response = await axios.delete(
                        `${process.env.BACKEND_URL}/api/v1/bot/orders/${actionId}`,
                        {
                            headers: {
                                authorization: `Bearer ${storeProfile.botId}`,
                            },
                        }
                    )
                    console.log('response:', response.data)
                }
                // Handle order cancellation
                if (event.source?.userId) {
                    clearConversationState(event.source.userId, storeProfile.id)
                }
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'ยกเลิกคำสั่งซื้อเรียบร้อยแล้วครับ',
                        },
                        guideMessage,
                    ],
                })
            case 'guide':
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'ตัวอย่างการใช้งานบอท 🤖',
                        },
                        {
                            type: 'text',
                            text: 'สั่งอาหาร -> "กะเพราหมู 1", "กะเพราหมู 1 ส่งที่ มจพ."\nเพิ่ม/เปลี่ยนที่อยู่ -> "ส่งที่ มจพ.", "เปลี่ยนที่ส่งเป็น หอ SP อยู่แถวๆ เซเว่น"',
                        },
                        {
                            type: 'text',
                            text: 'แก้ไขสินค้า -> "เอาหมูสับ 2 แทนที่ ข้าวกะเพราหมู 1", "เพิ่มไก่ทอด 2 จาน"',
                        },
                        {
                            type: 'text',
                            text: 'รายงานปัญหา -> "ของถึงยังครับ 🥶"',
                        },
                        guideMessage,
                    ],
                })
            case 'enable_bot':
                conversationState.isBotEnabled = true
                await setConversationState(conversationState)
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'textV2',
                            text: 'ผมกลับมาแล้วครับ {sticker1}',
                            substitution: {
                                sticker1: {
                                    type: 'emoji',
                                    productId: '670e0cce840a8236ddd4ee4c',
                                    emojiId: '057',
                                },
                            },
                        },
                        guideMessage,
                    ],
                })
            case 'close_bot':
                conversationState.isBotEnabled = false
                await setConversationState(conversationState)
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'textV2',
                            text: 'ผมทำการปิดการแชทด้วยบอทแล้วครับ {sticker1}',
                            substitution: {
                                sticker1: {
                                    type: 'emoji',
                                    productId: '670e0cce840a8236ddd4ee4c',
                                    emojiId: '130',
                                },
                            },
                        },
                        enableBotMessage,
                    ],
                })
            case 'contract_admin':
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: `สามารถติดต่อเจ้าของร้าน ${storeProfile.storeName} ได้ที่`,
                        },
                        {
                            type: 'text',
                            text: `เบอร์โทร: ${storeProfile.phone}`,
                        },
                        {
                            type: 'text',
                            text: `ที่อยู่: ${storeProfile.address}`,
                        },
                    ],
                })
        }
    }

    // BOT NOT ENABLED JUST DO NOTHING
    if (
        !conversationState.isBotEnabled &&
        event.message?.text?.toLowerCase() !== 'enable_bot'
    ) {
        return
    }

    // Handle text image message events
    if (event.type !== 'message' || event.message?.type !== 'text') {
        // handle image message
        if (event.message?.type === 'image') {
            try {
                // Get the response state to get transaction ID
                const responseState = await getResponseState(
                    event.source?.userId || ''
                )
                if (!responseState?.transaction?.id) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'ไม่พบข้อมูลการทำรายการ กรุณาสั่งซื้อใหม่',
                            },
                        ],
                    })
                }

                // download image to save to local with transaction ID
                const stream = await blobClient.getMessageContent(
                    event.message.id || ''
                )
                const pipelineAsync = util.promisify(pipeline)
                const publicPath = `./public/slip/${responseState.transaction.id}.jpg`
                const writeableStream = fs.createWriteStream(publicPath)
                await pipelineAsync(stream, writeableStream)
                console.log('image saved to:', publicPath)

                // Read the image file
                const imageBuffer = await Bun.file(publicPath).arrayBuffer()

                // Try to scan QR code first
                let refNbr = await scanQRCode(Buffer.from(imageBuffer))
                console.log('refNbr:', refNbr)
                // return

                if (!refNbr) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'ไม่พบรหัสอ้างอิงในสลิป กรุณาลองใหม่อีกครั้ง',
                            },
                            guideMessage,
                        ],
                    })
                }

                // Create form data for API request
                const formData = new FormData()
                formData.append('image', new Blob([imageBuffer]), 'slip.jpg')
                formData.append('refNbr', refNbr)

                // Send to verification API
                const verifyResponse = await fetch(
                    `${process.env.BACKEND_URL}/api/v1/bot/verify-slip/${responseState.transaction.id}`,
                    {
                        method: 'POST',
                        headers: {
                            authorization: `Bearer ${storeProfile.botId}`,
                        },
                        body: formData,
                    }
                )

                const result = await verifyResponse.json()

                if (!result.success) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'textV2',
                                text: `การตรวจสอบสลิปไม่สำเร็จ {sticker1}: ${result.error.message}`,
                                substitution: {
                                    sticker1: {
                                        type: 'emoji',
                                        productId: '670e0cce840a8236ddd4ee4c',
                                        emojiId: '006',
                                    },
                                },
                            },
                            {
                                type: 'textV2',
                                text: 'กรุณาลองใหม่อีกครั้ง {sticker1} หรือติดต่อแอดมินหากปัญหายังคงอยู่ {sticker2}',
                                substitution: {
                                    sticker1: {
                                        type: 'emoji',
                                        productId: '670e0cce840a8236ddd4ee4c',
                                        emojiId: '138',
                                    },
                                    sticker2: {
                                        type: 'emoji',
                                        productId: '670e0cce840a8236ddd4ee4c',
                                        emojiId: '073',
                                    },
                                },
                            },
                            guideMessage,
                        ],
                    })
                }

                // Clear response state after successful verification
                await clearResponseState(event.source?.userId || '')

                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'ตรวจสอบสลิปเรียบร้อยแล้ว กรุณารอการจัดส่งสินค้า',
                        },
                        guideMessage,
                    ],
                })
            } catch (error) {
                console.error('Error handling image message:', error)
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง',
                        },
                        guideMessage,
                    ],
                })
            }
        }
        return null
    }

    client.showLoadingAnimation({
        chatId: event.source?.userId || '',
        loadingSeconds: 60,
    })

    const [actual, fromAPI] = await callBot(event || '', storeProfile)
    console.log('actual:', actual)

    /*
    // console.log(actual)
    // const fromAPI = {
    //     success: true,
    //     data: {
    //         order: {
    //             productInfo: [
    //                 {
    //                     productId: '67c57265ddd44d3be965dc84',
    //                     name: 'ไก่สับ',
    //                     quantity: 1,
    //                 },
    //
    //             ],
    //             usedIngredients: [
    //                 {
    //                     ingredientId: '67c57265ddd44d3be965dc85',
    //                     name: 'เนื้อไก่',
    //                     quantity: 1,
    //                     price: 0,
    //                 },
    //             ],
    //             id: '67ea18de12a27c08465c5984',
    //             storeId: '67bec698b9483827dcf0c05a',
    //             customerLineId: 'Ua4439b0611353c66c91bf153e3e28046',
    //             customerName: 'Ratchanon B.',
    //             customerAdds: '101/12',
    //             status: 'PENDING',
    //             productIDs: ['67c57265ddd44d3be965dc84'],
    //             ingredientIDs: ['67c57265ddd44d3be965dc85'],
    //             createdAt: '2025-03-31T04:23:58.485Z',
    //             updatedAt: '2025-03-31T04:23:58.485Z',
    //         },
    //         transaction: {
    //             slip: null,
    //             id: '67ea18de12a27c08465c5985',
    //             slipId: null,
    //             totalAmount: 30,
    //             paymentMethod: null,
    //             orderId: '67ea18de12a27c08465c5984',
    //             createdAt: '2025-03-31T04:23:58.515Z',
    //             updatedAt: '2025-03-31T04:23:58.515Z',
    //         },
    //     },
    //     message: 'Order created successfully',
    //     timestamp: '3/31/2025, 11:23:58 AM',
    // }
    */

    // const fromAPI = null
    // const actual = 'show_cart'
    if (!fromAPI?.success && fromAPI !== null) {
        return client.replyMessage({
            replyToken: event.replyToken!,
            messages: [
                {
                    type: 'text',
                    text: `เกิดข้อผิดพลาด ${
                        fromAPI?.error?.message || 'ไม่มีข้อมูล'
                    }`,
                },
                guideMessage,
            ],
        })
    }

    const responsePromise = fromAPI?.data as BotResponse
    console.log('actual:', actual)
    console.log('responsePromise:', responsePromise)

    // Handle different order scenarios
    try {
        switch (actual) {
            case '':
                throw new Error('No action')
            case 'no_tool':
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'สวัสดีครับ',
                        },
                        guideMessage,
                    ],
                })
            case 'get_product':
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        createStoreProductListCarousel(
                            storeProfile
                        ) as TemplateMessage,
                        guideMessage,
                    ],
                })
            case 'show_cart':
                const placeConversationState_show = await getConversationState(
                    event.source?.userId || '',
                    storeProfile.id || ''
                )
                if (!placeConversationState_show?.currentOrder?.items) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [createEmptyCartFlexMessage(), guideMessage],
                    })
                }
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        createCartFlexMessage(
                            placeConversationState_show.currentOrder,
                            storeProfile
                        ),
                        guideMessage,
                    ],
                })
            case 'place_order':
                // Get current conversation state
                const placeConversationState = await getConversationState(
                    event.source?.userId || '',
                    storeProfile.id
                )

                if (!placeConversationState?.currentOrder?.items) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'ไม่พบคำสั่งซื้อที่ต้องการแสดง กรุณาสั่งซื้อใหม่',
                            },
                            guideMessage,
                        ],
                    })
                }

                // Show cart flex message
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        createCartFlexMessage(
                            placeConversationState.currentOrder,
                            storeProfile
                        ),
                        guideMessage,
                    ],
                })
                break
            case 'edit_address':
                const editAddressConversationState = await getConversationState(
                    event.source?.userId || '',
                    storeProfile.id
                )
                if (fromAPI?.success) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            createCartFlexMessage(
                                editAddressConversationState?.currentOrder,
                                storeProfile
                            ),
                            {
                                type: 'text',
                                text:
                                    fromAPI.data?.message ||
                                    'แก้ไขที่อยู่จัดส่งเรียบร้อย',
                            },
                            guideMessage,
                        ],
                    })
                }

                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'เกิดข้อผิดพลาดในการแก้ไขที่อยู่จัดส่ง กรุณาลองใหม่อีกครั้ง',
                        },
                    ],
                })
                break
            case 'edit_items':
                // Get current conversation state
                const editConversationState = await getConversationState(
                    event.source?.userId || '',
                    storeProfile.id
                )

                if (!editConversationState?.currentOrder?.items) {
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: 'ไม่พบคำสั่งซื้อที่ต้องการแก้ไข กรุณาสั่งซื้อใหม่',
                            },
                            guideMessage,
                        ],
                    })
                }

                // Show updated cart flex message
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        createCartFlexMessage(
                            editConversationState.currentOrder,
                            storeProfile
                        ),
                        guideMessage,
                    ],
                })
                break

            case 'cancel_order':
                if (responsePromise) {
                    // Cancel confirmed, clear conversation state
                    if (event.source?.userId) {
                        clearConversationState(
                            event.source.userId,
                            storeProfile.id
                        )
                    }
                }
                break

            case 'report_issue':
                if (fromAPI?.success) {
                    conversationState.isBotEnabled = false
                    await setConversationState(conversationState)
                    return client.replyMessage({
                        replyToken: event.replyToken!,
                        messages: [
                            {
                                type: 'text',
                                text: `รับทราบข้อมูลปัญหาเรียบร้อย`,
                            },
                            {
                                type: 'text',
                                text: '🔴 ทำการปิดการทำงานของบอท กรุณารอการตรวจสอบปัญหา',
                            },
                            {
                                type: 'flex',
                                altText: 'Bot is disabled',
                                contents: {
                                    type: 'bubble',
                                    footer: {
                                        type: 'box',
                                        layout: 'vertical',
                                        spacing: 'sm',
                                        contents: [
                                            {
                                                type: 'button',
                                                style: 'primary',
                                                action: {
                                                    type: 'postback',
                                                    data: 'action=enable_bot',
                                                    label: 'เปิดการใช้งานบอท 🤖',
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    })
                }
                break
            case 'enable_bot':
                conversationState.isBotEnabled = true
                await setConversationState(conversationState)
                return client.replyMessage({
                    replyToken: event.replyToken!,
                    messages: [
                        {
                            type: 'text',
                            text: 'ผมกลับมาแล้วครับ สามารถสั่งซื้ออาหารได้ตอนนี้เลยครับ',
                        },
                    ],
                })
        }
    } catch (error) {
        const message0: Message = {
            type: 'text',
            text: `error: ${error}`,
        }
        const message1: Message = {
            type: 'text',
            text: 'server_status: 🟢 Server is running...',
        }
        const message2: Message = {
            type: 'textV2',
            text: 'เกิดข้อผิดพลาดกับการสร้างคำสั่งซื้อกรุณาลองใหม่อีกครั้ง 🔁',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            data: 'action=close_bot',
                            label: 'ปิดการใช้งานบอท 🤖',
                        },
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            data: 'action=contract_admin',
                            label: 'ติดต่อแอดมิน 📲',
                        },
                    },
                ],
            },
        }

        return client.replyMessage({
            replyToken: event.replyToken!,
            messages: [message0, message1, message2],
        })
    }

    let promptpayId = null
    let promptpayUrl = null
    const messages: Message[] = []

    // Get promptpay ID from store profile
    storeProfile.accounts.map((i: any) => {
        if (i.promptpayId !== '') {
            promptpayId = i.promptpayId
        }
    })

    // Add payment messages if applicable
    // if (responsePromise) {
    //     const paymentMessages = createPaymentMessages(
    //         promptpayId,
    //         responsePromise
    //     )
    //     messages.push(...paymentMessages)
    // }

    return client.replyMessage({
        replyToken: event.replyToken!,
        messages,
    })
}

function createCarouselAccount(
    storeAccounts: any
): TemplateMessage | undefined {
    console.log('storeAccounts:', storeAccounts)
    if (storeAccounts.length > 0) {
        return {
            type: 'template',
            altText: 'Account lists',
            template: {
                type: 'carousel',
                columns: storeAccounts.map((account: any, index: number) => {
                    let imageUrl = ''
                    if (account.receiverType == 'BANK') {
                        imageUrl = `https://raw.githubusercontent.com/casperstack/thai-banks-logo/refs/heads/master/icons/${account.receiverBank}.png`
                    } else {
                        imageUrl =
                            'https://www.punboon.org/_next/static/images/qr2-506d233a6277b23b5ca9ed397c3bf391.png'
                    }
                    return {
                        thumbnailImageUrl: imageUrl,
                        imageBackgroundColor: '#FFFFFF',
                        title: account.receiverBank
                            ? account.receiverBank
                            : 'PromptPay',
                        text: account.accountNameTh,
                        actions: [
                            {
                                type: 'postback',
                                data: 'action=select_account&index=' + index,
                                label: 'เลือกช่องทางชำระเงิน',
                            },
                        ],
                    }
                }),
            },
        }
    }
}

// Add new function to create bank account messages
function createBankAccountMessages(
    storeAccounts: any,
    response: BotResponse
): FlexMessage | undefined {
    if (!response.transaction) return undefined

    return {
        type: 'flex',
        altText: 'Shopping Cart',
        contents: {
            type: 'bubble',
            hero: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0a0a0a',
                contents: [
                    {
                        type: 'image',
                        url: `${process.env.BACKEND_PUBLIC_URL}/assets/logo-light@2x.png`,
                        size: 'sm',
                        aspectRatio: '16:9',
                        align: 'center',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Bank Account',
                        weight: 'bold',
                        color: '#1DB446',
                        size: 'sm',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'lg',
                        contents: [
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'สร้างวันที่',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: new Date(
                                            response.transaction.createdAt
                                        ).toLocaleDateString('th-TH', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                        }),
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'orderId',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: response.transaction.orderId,
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'TsId',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: response.transaction.id,
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'xxl',
                        contents: [
                            {
                                type: 'image',
                                url: `https://raw.githubusercontent.com/casperstack/thai-banks-logo/refs/heads/master/icons/${storeAccounts.receiverBank}.png`,
                                size: 'xxl',
                                margin: 'none',
                                aspectMode: 'cover',
                            },
                            {
                                type: 'text',
                                text: storeAccounts.receiverAccount,
                                size: 'xxl',
                                color: '#666666',
                                weight: 'bold',
                                align: 'center',
                                margin: 'xxl',
                                wrap: true,
                            },
                            {
                                type: 'text',
                                text:
                                    response.transaction.totalAmount.toLocaleString() +
                                    ' บาท',
                                size: 'lg',
                                color: '#666666',
                                weight: 'bold',
                                align: 'center',
                                margin: 'xxl',
                                wrap: true,
                            },
                            {
                                type: 'text',
                                text: storeAccounts.accountNameTh,
                                size: 'md',
                                color: '#111111',
                                weight: 'bold',
                                align: 'center',
                                wrap: true,
                                margin: 'none',
                            },
                            {
                                type: 'text',
                                text: storeAccounts.accountNameEn,
                                size: 'md',
                                color: '#111111',
                                weight: 'bold',
                                align: 'center',
                                wrap: true,
                                margin: 'none',
                            },
                            {
                                type: 'text',
                                text: 'คุณสามารถชำระเงินด้วยโอนเงินตามหมายเลขบัญชีด้านบน และส่ง Slip ในแชทเพื่อยืนยันการชำระเงิน',
                                size: 'xs',
                                color: '#aaaaaa',
                                margin: 'xxl',
                                wrap: true,
                            },
                        ],
                    },
                ],
            },
        },
    }
}

// Add new function to create payment messages
function createPaymentMessages(
    promptpayProfile: any,
    response: BotResponse
): FlexMessage | undefined {
    if (!response.transaction) return undefined

    const promptpayUrl = `https://promptpay.io/${promptpayProfile.promptpayId}/${response.transaction.totalAmount}.png`

    return {
        type: 'flex',
        altText: 'Shopping Cart',
        contents: {
            type: 'bubble',
            hero: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0a0a0a',
                contents: [
                    {
                        type: 'image',
                        url: `${process.env.BACKEND_PUBLIC_URL}/assets/logo-light@2x.png`,
                        size: 'sm',
                        aspectRatio: '16:9',
                        align: 'center',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'PromptPay',
                        weight: 'bold',
                        color: '#1DB446',
                        size: 'sm',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'lg',
                        contents: [
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'สร้างวันที่',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: new Date(
                                            response.transaction.createdAt
                                        ).toLocaleDateString('th-TH', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                        }),
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'orderId',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: response.transaction.orderId,
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'TsId',
                                        size: 'sm',
                                        color: '#aaaaaa',
                                        flex: 1,
                                    },
                                    {
                                        type: 'text',
                                        text: response.transaction.id,
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 3,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'image',
                        url: 'https://www.punboon.org/_next/static/images/qr2-506d233a6277b23b5ca9ed397c3bf391.png',
                        size: 'full',
                        aspectRatio: '25:9',
                        margin: 'xl',
                        aspectMode: 'cover',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'xxl',
                        contents: [
                            {
                                type: 'image',
                                url: promptpayUrl,
                                size: '3xl',
                                margin: 'none',
                                aspectMode: 'cover',
                            },
                            {
                                type: 'text',
                                text:
                                    response.transaction.totalAmount.toLocaleString() +
                                    ' บาท',
                                size: 'lg',
                                color: '#666666',
                                weight: 'bold',
                                align: 'center',
                                margin: 'xxl',
                                wrap: true,
                            },
                            {
                                type: 'text',
                                text: promptpayProfile.accountNameTh,
                                size: 'md',
                                color: '#111111',
                                weight: 'bold',
                                align: 'center',
                                wrap: true,
                                margin: 'none',
                            },
                            {
                                type: 'text',
                                text: promptpayProfile.accountNameEn,
                                size: 'md',
                                color: '#111111',
                                weight: 'bold',
                                align: 'center',
                                wrap: true,
                                margin: 'none',
                            },
                            {
                                type: 'text',
                                text: 'คุณสามารถชำระเงินด้วยการสแกน QR Code ด้านบน และส่ง Slip ในแชทเพื่อยืนยันการชำระเงิน',
                                size: 'xs',
                                color: '#aaaaaa',
                                margin: 'xxl',
                                wrap: true,
                            },
                        ],
                        action: {
                            type: 'uri',
                            label: 'open promptpay',
                            uri: promptpayUrl,
                        },
                    },
                ],
            },
        },
    }
}

function createEmptyCartFlexMessage(): FlexMessage {
    return {
        type: 'flex',
        altText: 'Shopping Cart',
        contents: {
            type: 'bubble',
            hero: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0a0a0a',
                contents: [
                    {
                        type: 'image',
                        url: `${process.env.BACKEND_PUBLIC_URL}/assets/logo-light@2x.png`,
                        size: 'sm',
                        aspectRatio: '16:9',
                        align: 'center',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'CART',
                        weight: 'bold',
                        color: '#1DB446',
                        size: 'sm',
                    },
                    {
                        type: 'text',
                        text: 'ไม่พบคำสั่งซื้อ',
                        size: 'sm',
                    },
                ],
            },
        },
    }
}

// Add new function to create cart flex message
function createCartFlexMessage(
    currentOrder: any,
    storeProfile: any
): FlexMessage {
    const productInfo =
        currentOrder.items?.map((item: any) => ({
            summary:
                item.name +
                ' x' +
                item.quantity +
                ' ' +
                (item.customization ? item.customization : ''),
            price: item.price,
        })) || []

    const totalItems = currentOrder.items.reduce(
        (acc: number, item: any) => acc + item.quantity,
        0
    )
    const totalAmount = currentOrder.items.reduce((acc: number, item: any) => {
        const product = storeProfile.product.find(
            (p: any) => p.name === item.name
        )
        item.price = product ? product.price : 0
        return acc + (product ? product.price * item.quantity : 0)
    }, 0)

    return {
        type: 'flex',
        altText: 'Shopping Cart',
        contents: {
            type: 'bubble',
            hero: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0a0a0a',
                contents: [
                    {
                        type: 'image',
                        url: `${process.env.BACKEND_PUBLIC_URL}/assets/logo-light@2x.png`,
                        size: 'sm',
                        aspectRatio: '16:9',
                        align: 'center',
                        gravity: 'top',
                        offsetTop: 'none',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'CART',
                        weight: 'bold',
                        color: '#1DB446',
                        size: 'sm',
                    },
                    {
                        type: 'text',
                        text: storeProfile.storeName || 'Store',
                        weight: 'bold',
                        size: 'xxl',
                        margin: 'md',
                    },
                    {
                        type: 'text',
                        text: 'คุณ: ' + currentOrder.customerName,
                        weight: 'bold',
                        size: 'sm',
                        color: '#aaaaaa',
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text:
                            'ที่อยู่ส่งสินค้า: ' + currentOrder.deliveryAddress,
                        size: 'xs',
                        color: '#aaaaaa',
                        wrap: true,
                    },
                    {
                        type: 'separator',
                        margin: 'xxl',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'xxl',
                        spacing: 'sm',
                        contents: [
                            ...productInfo.map((item: any) => ({
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'text',
                                        text: item.summary,
                                        size: 'sm',
                                        color: '#555555',
                                        flex: 0,
                                    },
                                    {
                                        type: 'text',
                                        text: item.price + ' บาท/ชิ้น',
                                        size: 'sm',
                                        color: '#111111',
                                        align: 'end',
                                    },
                                ],
                            })),
                        ],
                    },
                    {
                        type: 'separator',
                        margin: 'xxl',
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'xxl',
                        contents: [
                            {
                                type: 'text',
                                text: 'ทั้งหมด',
                                size: 'sm',
                                color: '#555555',
                            },
                            {
                                type: 'text',
                                text: totalItems + ' ชิ้น',
                                size: 'sm',
                                color: '#111111',
                                align: 'end',
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: 'ราคารวม',
                                size: 'sm',
                                color: '#555555',
                            },
                            {
                                type: 'text',
                                text: totalAmount + ' บาท',
                                size: 'sm',
                                color: '#111111',
                                align: 'end',
                            },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        action: {
                            type: 'postback',
                            label: 'ยืนยันคำสั่งซื้อ',
                            data: `action=confirm&orderId=${currentOrder.orderId}`,
                        },
                    },
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: 'ยกเลิกคำสั่งซื้อ',
                            data: `action=cancel&orderId=${currentOrder.orderId}`,
                        },
                    },
                ],
            },
        },
    }
}

// Add new function to create order flex message
function createOrderFlexMessage(
    response: any,
    storeProfile: any,
    productInfo: any,
    userInfo: string,
    deliveryAddress: string,
    totalItems: number
): FlexMessage {
    return {
        type: 'flex',
        altText: 'Order Confirmation',
        contents: {
            type: 'bubble',
            hero: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0a0a0a',
                contents: [
                    {
                        type: 'image',
                        url: `${process.env.BACKEND_PUBLIC_URL}/assets/logo-light@2x.png`,
                        size: 'sm',
                        aspectRatio: '16:9',
                        align: 'center',
                        gravity: 'top',
                        offsetTop: 'none',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'RECEIPT',
                        weight: 'bold',
                        color: '#1DB446',
                        size: 'sm',
                    },
                    {
                        type: 'text',
                        text: storeProfile.storeName || 'Store',
                        weight: 'bold',
                        size: 'xxl',
                        margin: 'md',
                    },
                    {
                        type: 'text',
                        text: 'คุณ: ' + userInfo,
                        weight: 'bold',
                        size: 'sm',
                        color: '#aaaaaa',
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: 'ที่อยู่ส่งสินค้า: ' + deliveryAddress,
                        size: 'xs',
                        color: '#aaaaaa',
                        wrap: true,
                    },
                    {
                        type: 'separator',
                        margin: 'xxl',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'xxl',
                        spacing: 'sm',
                        contents: [
                            ...productInfo.map((item: any) => ({
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'text',
                                        text: item.summary,
                                        size: 'sm',
                                        color: '#555555',
                                        flex: 0,
                                    },
                                    {
                                        type: 'text',
                                        text: item.price + ' บาท/ชิ้น',
                                        size: 'sm',
                                        color: '#111111',
                                        align: 'end',
                                    },
                                ],
                            })),
                        ],
                    },
                    {
                        type: 'separator',
                        margin: 'xxl',
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'xxl',
                        contents: [
                            {
                                type: 'text',
                                text: 'ทั้งหมด',
                                size: 'sm',
                                color: '#555555',
                            },
                            {
                                type: 'text',
                                text: totalItems + ' ชิ้น',
                                size: 'sm',
                                color: '#111111',
                                align: 'end',
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: 'ราคารวม',
                                size: 'sm',
                                color: '#555555',
                            },
                            {
                                type: 'text',
                                text: response.transaction.totalAmount + ' บาท',
                                size: 'sm',
                                color: '#111111',
                                align: 'end',
                            },
                        ],
                    },
                    {
                        type: 'separator',
                        margin: 'xxl',
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'md',
                        contents: [
                            {
                                type: 'text',
                                text: 'ORDER ID',
                                size: 'xs',
                                color: '#aaaaaa',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                text: response.order.id,
                                color: '#aaaaaa',
                                size: 'xs',
                                align: 'end',
                            },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'postback',
                            label: 'ยกเลิกคำสั่งซื้อ',
                            data: `action=cancel&orderId=${response.order.id}`,
                        },
                    },
                ],
            },
        },
    }
}

function createStoreProductListCarousel(storeProfile: any): TemplateMessage {
    console.log('storeProduct:', storeProfile.product)
    if (storeProfile.product.length > 0) {
        return {
            type: 'template',
            altText: 'Product lists',
            template: {
                type: 'carousel',
                columns: storeProfile.product.map(
                    (product: any, index: number) => {
                        let imageUrl = ''
                        if (product.imageUrl) {
                            if (product.imageUrl.startsWith('/')) {
                                imageUrl = `${process.env.BACKEND_PUBLIC_URL}${product.imageUrl}`
                            } else {
                                imageUrl = `${process.env.BACKEND_PUBLIC_URL}/${product.imageUrl}`
                            }
                            console.log('imageUrl:', imageUrl)
                        } else {
                            imageUrl = `${process.env.BACKEND_PUBLIC_URL}/products/package.svg`
                        }
                        return {
                            thumbnailImageUrl: imageUrl,
                            imageBackgroundColor: '#FFFFFF',
                            title: product.name,
                            text: product.price + '฿',
                            actions: [
                                {
                                    type: 'postback',
                                    data:
                                        'action=select_product&index=' + index,
                                    label: 'เลือกสินค้า',
                                },
                            ],
                        }
                    }
                ),
            },
        }
    } else {
        return {
            type: 'template',
            altText: 'No products found',
            template: { type: 'carousel', columns: [] },
        }
    }
}

/*
You are a Thai food order assistant responsible for handling three functions:
                1) New orders,
                2) Order modifications,
                3) Delivery issues.
                Follow these rules strictly:
                
                1. Use \`place_order()\` when ALL of these are true:
                   - The message contains food items AND a delivery address.
                   - There is NO reference to modifying an existing order (i.e., it's a new order).
                   - Even if the user uses 'เพิ่ม' in the context of placing a brand-new order.
                   Example: 'เอา X ส่งที่ Y' → \`place_order()\`
                
                2. Use \`edit_items()\` ONLY when:
                   - The message includes modification verbs (เพิ่ม, เปลี่ยน, ลบ, แก้ไข, เอาเพิ่ม) **indicating a change to an existing order**.
                   - The message does NOT contain a delivery address (or implicitly refers to an existing order without mentioning a new address).
                   - The user is adjusting, adding, or removing items from a previous order.
                   Example: 'เพิ่มแซนวิสไข่ 1 กับแซนวิสไก่ 1' or 'เอาแซนวิสไข่ 2 ชิ้นเพิ่มครับ' → \`edit_items()\`
                
                3. Use \`report_delivery_issue()\` for:
                   - Delivery problems (wrong address, missing items, delayed order, etc.).
                   - Any complaints related to the delivery process.
                   Example: 'ส่งผิดที่' → \`report_delivery_issue()\`
                
                4. Decision flow:
                   - **Step 1:** If the user reports a delivery issue → \`report_delivery_issue()\`
                   - **Step 2:** If the message contains **both** food items **and** a delivery address → \`place_order()\`
                   - **Step 3:** If the message contains modification verbs and lacks a delivery address → \`edit_items()\`
                
                5. Additional rules:
                   - Never translate menu items; use the names exactly as provided.
                   - Place any special requests in the 'special_requests' field when applicable.
                
                ### Examples:
                - 'เอาผัดกะเพราไม่ใส่ใบกะเพรา 1 จาน ส่งที่...' → \`place_order()\`
                - 'เพิ่มอกไก่ในออเดอร์เก่า' → \`edit_items()\`
                - 'ส่งผิดที่' → \`report_delivery_issue()\`
                
                Ensure you **strictly** follow these guidelines and do not misclassify modification requests as new orders.
*/

// Add LangChain tools
const productTool = tool((_) => 'Product info', {
    name: 'get_product',
    description: 'Retrieve product information from the menu.',
    schema: z.object({
        operation: z
            .enum(['search', 'all'])
            .describe(
                "Operation type: 'search' to query specific products, 'all' to retrieve all available products."
            ),
        query: z
            .string()
            .optional()
            .describe(
                "The query string used for searching products. Relevant only when 'operation' is 'search'."
            ),
    }),
})

const orderTool = tool((_) => 'Order placed', {
    name: 'place_order',
    description: 'Place a food order with customization and delivery details.',
    schema: z.object({
        items: z
            .array(
                z.object({
                    name: z.string().describe('The name of the food item.'),
                    quantity: z.number().describe('The quantity of the item.'),
                    customization: z
                        .string()
                        .optional()
                        .describe(
                            'Any special requests or modifications to the item.'
                        ),
                })
            )
            .describe('List of food items ordered.'),
        note: z
            .string()
            .optional()
            .describe('Any additional notes or instructions for the order.'),
        delivery_address: z
            .string()
            .describe('The address where the order should be delivered.'),
    }),
})

const editItemsTool = tool((_) => 'Items edited', {
    name: 'edit_items',
    description: 'Modify the items in an existing order.',
    schema: z.object({
        modifications: z
            .array(
                z.object({
                    operation: z
                        .enum(['add', 'remove', 'replace'])
                        .describe(
                            "Operation type: 'add' to increase an item, 'remove' to delete an item, 'replace' to swap an item."
                        ),
                    name: z.string().describe('The name of the food item.'),
                    quantity: z
                        .number()
                        .describe('The number of units for this food item.'),
                    replacement_name: z
                        .string()
                        .optional()
                        .describe(
                            "If operation is 'replace', this is the new item name."
                        ),
                    replacement_quantity: z
                        .number()
                        .optional()
                        .describe(
                            "If operation is 'replace', this is the quantity of the new item."
                        ),
                    customization: z
                        .string()
                        .optional()
                        .describe(
                            'Any customizations or special requests for the item.'
                        ),
                })
            )
            .describe('List of changes to be made to the order.'),
    }),
})

const editAddressTool = tool((_) => 'Address updated', {
    name: 'edit_address',
    description: 'Update the delivery address of an existing order.',
    schema: z.object({
        new_address: z.string().describe('The new delivery address.'),
    }),
})

const cancelOrderTool = tool((_) => 'Order cancelled', {
    name: 'cancel_order',
    description: 'Cancel an existing order.',
    schema: z.object({
        reason: z
            .string()
            .optional()
            .describe('The reason for canceling the order.'),
    }),
})

const reportIssueTool = tool((_) => 'Issue reported', {
    name: 'report_issue',
    description: 'Report an any issue.',
    schema: z.object({
        issue: z
            .string()
            .describe(
                'A description of the issue. eg. ทำอาหารช้า, ของมาส่งยังครับ'
            ),
    }),
})

const notUnderstoodTool = tool((_) => 'Not understood', {
    name: 'not_understood',
    description: "Handle cases where the user's request is not understood.",
    schema: z.object({
        message: z.string().describe('The message to display to the user.'),
    }),
})

const editOrderTool = tool((_) => 'Order edited', {
    name: 'edit_order',
    description: 'Edit an existing order.',
    schema: z.object({
        type: z
            .enum(['items', 'address'])
            .describe(
                'The type of edit. eg. เอาข้าวออก = items, เปลี่ยนที่ส่ง = address'
            ),
    }),
})

async function fakeCallBot(
    event: any,
    storeProfile: any,
    command: number
): Promise<[string, BotResponse | null]> {
    if (command === 1) {
        const response = await executeFunction(
            {
                function: {
                    name: 'place_order',
                    arguments: JSON.stringify({
                        items: [
                            {
                                name: 'กะเพราหมู',
                                quantity: 3,
                            },
                            {
                                name: 'ไก่สับ',
                                quantity: 5,
                            },
                        ],
                        delivery_address: '123 ถนนสุขุมวิถี กทม.',
                    }),
                },
            },
            event,
            storeProfile
        )

        return ['place_order', response]
    } else if (command === 2) {
        const response = await executeFunction(
            {
                function: {
                    name: 'edit_items',
                    arguments: JSON.stringify({
                        modifications: [
                            {
                                operation: 'add',
                                name: 'กะเพราหมู',
                                quantity: 1,
                                customization: 'ไม่ใส่พริก',
                            },
                        ],
                    }),
                },
            },
            event,
            storeProfile
        )
        return ['edit_items', response]
    } else if (command === 3) {
        return ['get_product', null]
    } else return ['', null]
}

async function callBotWithLangChain(
    event: any,
    storeProfile: any
): Promise<[string, BotResponse | null]> {
    try {
        const startTime = new Date()
        const food_info = storeProfile.product.map((item: any) => item.name)
        const prompt = event.message.text
        console.log('food_info:', food_info)
        const llmForSchema = new ChatOllama({
            model: aiProviders[currentProviderIndex].models[currentModelIndex],
            baseUrl: aiProviders[currentProviderIndex].baseURL,
        })
        // test simple call
        // const simpleCall = await llmForSchema.invoke([['human', prompt]])
        // console.log('simpleCall:', simpleCall)

        const llmWithSchema = llmForSchema.bindTools([
            productTool,
            orderTool,
            editOrderTool,
            cancelOrderTool,
            reportIssueTool,
            notUnderstoodTool,
        ])

        const schemaStart = new Date()
        console.log('called first llm...')

        // cart state for more context
        const placeConversationState_show = await getConversationState(
            event.source?.userId || '',
            storeProfile.id
        )
        // console.log(
        //     'placeConversationState_show:',
        //     placeConversationState_show?.currentOrder
        // )
        // First call to identify the tool based on the user prompt
        const resultFromIdentification = await llmWithSchema.invoke([
            [
                'system',
                `/set nothink
                # Instructions
                คุณคือ AI ภาษาไทยที่จะสกัดข้อมูลจากข้อความโดยไม่แก้ไขข้อความต้นฉบับใด ๆ หรือใส่บริบทเพิ่มเติม.

                # Knowledge
                รายการอาหาร: ${JSON.stringify(food_info)}
                สถานะคำสั่งซื้อ: ${JSON.stringify(
                    placeConversationState_show?.currentOrder
                )}

                # Objectives
                1. คุณส่งกลับเฉพาะข้อมูลที่จำเป็น เช่น "place order" จะมาพร้อม ชื่ออาหาร, จำนวน, ที่อยู่(ถ้ามี) ดูได้จาก cart empty
                2. ขอเมนู
                3. ขอยกเลิก
                4. ขอแก้ไขคำสั่งซื้อ (เพิ่ม ลด หรือ ลบ) 
                5. แก้ไขที่อยู่สามารถรู้ในกรณืที่ผู้ใช้ส่งมาแค่ที่อยู่ เช่น "เปลี่ยนที่ส่ง", "เปลี่ยนที่อยู่"
                6. รายงาน เช่น "รายงานปัญหา", "อาหารยังไม่ได้รับ"
                
                # Rules
                1. ส่งกลับข้อความต้นฉบับ ห้ามสรุปหรือใส่บริบทเพิ่มเติม
            `,
            ],
            ['human', prompt],
        ])
        const schemaEnd = new Date()
        console.log(
            'time taken:',
            schemaEnd.getTime() - schemaStart.getTime(),
            'ms'
        )

        let toolName: any
        if (resultFromIdentification.tool_calls?.[0]) {
            toolName = resultFromIdentification.tool_calls?.[0].name
        }
        if (!toolName) {
            console.log('No tool identified.')
            return ['no_tool', null]
        }

        // Define valid tool names as a union type
        type ToolNames =
            | 'get_product'
            | 'place_order'
            | 'edit_address'
            | 'edit_order'
            | 'cancel_order'
            | 'report_issue'
            | 'not_understood'

        // Map identified tool name to the corresponding function
        const toolToInvoke: Record<ToolNames, any> = {
            get_product: productTool,
            place_order: orderTool,
            edit_address: editAddressTool,
            edit_order: editOrderTool,
            cancel_order: cancelOrderTool,
            report_issue: reportIssueTool,
            not_understood: notUnderstoodTool,
        }

        let responseFormat = {
            prompt: prompt,
            toolName: toolName,
            response: resultFromIdentification.tool_calls?.[0].args,
        }

        const llmForTool = new ChatOllama({
            model: aiProviders[currentProviderIndex].models[currentModelIndex],
            baseUrl: aiProviders[currentProviderIndex].baseURL,
        })

        let llmWithTools: any
        // return to line
        switch (toolName) {
            case 'get_product':
                return [
                    toolName,
                    {
                        success: true,
                    },
                ]
            case 'edit_order':
                if (
                    resultFromIdentification.tool_calls?.[0].args.type ===
                    'address'
                ) {
                    llmWithTools = llmForTool.withStructuredOutput(
                        editAddressTool.schema,
                        {
                            name: editAddressTool.name.toString(),
                        }
                    )
                } else {
                    llmWithTools = llmForTool.withStructuredOutput(
                        editItemsTool.schema,
                        {
                            name: editItemsTool.name.toString(),
                        }
                    )
                }
                break
            case 'report_issue':
                return [
                    toolName,
                    {
                        success: true,
                    },
                ]
            case 'cancel_order':
                return [toolName, null]
            case 'not_understood':
                return [
                    toolName,
                    {
                        success: false,
                        error: {
                            message: `ไม่เข้าใจคำสั่งของคุณ ${prompt}`,
                        },
                    },
                ]
            default:
                llmWithTools = llmForTool.withStructuredOutput(
                    toolToInvoke[toolName as ToolNames].schema,
                    {
                        name: toolToInvoke[
                            toolName as ToolNames
                        ].name.toString(),
                    }
                )
                break
        }

        const toolStart = new Date()
        console.log('called second llm...')
        // Second call to invoke the identified tool
        const resultFromTool = await llmWithTools.invoke([
            [
                'system',
                `/set nothink
                # Instructions
                คุณคือ AI ภาษาไทยที่จะสกัดข้อมูลจากข้อความโดยไม่แก้ไขข้อความต้นฉบับใด ๆ หรือใส่บริบทเพิ่มเติม.

                # Knowledge
                รายการอาหาร: ${JSON.stringify(food_info)}
                สถานะคำสั่งซื้อ: ${JSON.stringify(
                    placeConversationState_show?.currentOrder
                )}

                # Objectives
                1. คุณส่งกลับเฉพาะข้อมูลที่จำเป็น เช่น "place order" จะมาพร้อม ชื่ออาหาร, จำนวน, ที่อยู่(ถ้ามี) ดูได้จาก cart empty
                2. ขอเมนู
                3. ขอยกเลิก
                4. ขอแก้ไขคำสั่งซื้อ (เพิ่ม ลด หรือ ลบ) 
                5. แก้ไขที่อยู่สามารถรู้ในกรณืที่ผู้ใช้ส่งมาแค่ที่อยู่ เช่น "เปลี่ยนที่ส่ง", "เปลี่ยนที่อยู่"
                6. รายงาน เช่น "รายงานปัญหา", "อาหารยังไม่ได้รับ"
                
                # Rules
                1. ส่งกลับข้อความต้นฉบับ ห้ามสรุปหรือใส่บริบทเพิ่มเติม
            `,
            ],
            ['human', prompt],
        ])
        const toolEnd = new Date()
        console.log(
            'time taken:',
            toolEnd.getTime() - toolStart.getTime(),
            'ms'
        )

        responseFormat.toolName =
            toolName === 'edit_order'
                ? resultFromIdentification.tool_calls?.[0].args.type ===
                  'address'
                    ? 'edit_address'
                    : 'edit_items'
                : toolName
        responseFormat.response = resultFromTool

        // Execute the function based on the tool name
        const response = await executeFunction(
            {
                function: {
                    name: responseFormat.toolName,
                    arguments: JSON.stringify(responseFormat.response),
                },
            },
            event,
            storeProfile
        )

        return [responseFormat.toolName, response]
    } catch (error) {
        console.error('Error in LangChain implementation:', error)
        return ['', null]
    }
}

const fastFilter = [
    'มีอะไรบ้าง',
    'มีอะไรบ้าง',
    'เมนู',
    'รายการอาหาร',
    'มีอาหารอะไรบ้าง',
]

// Modify the existing callBot function to use the new LangChain implementation
async function callBot(
    event: any,
    storeProfile: any
): Promise<[string, BotResponse | null]> {
    const prompt = event.message.text

    // Use LangChain implementation
    // return callBotWithLangChain(event, storeProfile)
    if (event.message?.text?.toLowerCase() === 'show_cart') {
        return ['show_cart', null]
    } else if (event.message?.text?.toLowerCase() in fastFilter) {
        return ['get_product', null]
    } else if (event.message?.text?.toLowerCase() === 'add') {
        return fakeCallBot(event, storeProfile, 1)
    } else if (event.message?.text?.toLowerCase() === 'edit') {
        return fakeCallBot(event, storeProfile, 2)
    } else if (
        event.message?.text?.toLowerCase() === 'get_product' ||
        event.message?.text?.toLowerCase() === 'product_list'
    ) {
        return ['get_product', null]
    } else if (event.message?.text?.toLowerCase() === 'enable_bot') {
        return ['enable_bot', null]
    }
    return callBotWithLangChain(event, storeProfile)
}

async function executeFunction(
    toolCalls: any,
    event: any,
    storeProfile: any
): Promise<BotResponse | null> {
    if (!toolCalls) return null

    const args = JSON.parse(toolCalls.function.arguments)
    console.log('args', args)
    // Function mapping
    const functionMap: Record<
        string,
        (
            args: any,
            event: any,
            storeProfile: any
        ) => Promise<BotResponse | null>
    > = {
        place_order,
        edit_items,
        get_product,
        edit_address,
    }

    // Check if function exists in mapping
    if (toolCalls.function.name in functionMap) {
        return functionMap[toolCalls.function.name](args, event, storeProfile)
    } else {
        console.error('Function not found:', toolCalls.function.name)
        return null
    }
}

type OrderArgs = { items: any; delivery_address: string }
type EditArgs = {
    modifications: [
        {
            operation: string
            name?: string
            quantity?: number
            customization?: string
            replacement_name?: string
            replacement_quantity?: number
        }
    ]
}
type ProductArgs = { operation: string; query: string }
async function place_order(
    args: OrderArgs,
    event: any,
    storeProfile: any
): Promise<BotResponse | null> {
    let conversationState = await getConversationState(
        event.source?.userId || '',
        storeProfile.id
    )

    // If we're in cart mode and have existing items, merge them with new items
    if (
        conversationState?.orderType === 'cart' &&
        conversationState.currentOrder?.items
    ) {
        const findProducts = args.items
            .map((item: any) => {
                const product = storeProfile.product.find(
                    (product: any) => product.name === item.name
                )
                console.log('product in place_order ->', product)
                if (product) {
                    return {
                        productId: product.id,
                        name: product.name,
                        quantity: item.quantity,
                        price: product.price,
                        customization: item.customization,
                    }
                }
                return null
            })
            .filter((item: any) => item !== null)

        // Merge existing items with new items
        const existingItems = conversationState.currentOrder.items
        const newItems = findProducts

        // Create a map of existing items by name and customization
        const existingItemsMap = new Map()
        existingItems.forEach((item: any) => {
            const key = `${item.name}-${item.customization || ''}`
            existingItemsMap.set(key, item)
        })

        // Merge new items with existing items
        newItems.forEach((item: any) => {
            const key = `${item.name}-${item.customization || ''}`
            if (existingItemsMap.has(key)) {
                // Update quantity if item exists
                const existingItem = existingItemsMap.get(key)
                existingItem.quantity += item.quantity
            } else {
                // Add new item
                existingItems.push(item)
            }
        })

        // Update conversation state with merged items
        conversationState.currentOrder.items = existingItems
        conversationState.currentOrder.deliveryAddress = args.delivery_address
        conversationState.currentOrder.customerName =
            event.profile.displayName || ''
        await setConversationState(conversationState)

        return null
    }

    // For new orders, store in conversation state first
    const findProducts = args.items
        .map((item: any) => {
            const product = storeProfile.product.find(
                (product: any) => product.name === item.name
            )
            if (product) {
                return {
                    productId: product.id,
                    name: product.name,
                    quantity: item.quantity,
                    price: product.price,
                    customization: item.customization || '',
                }
            }
            return null
        })
        .filter((item: any) => item !== null)

    console.log('Find Products', findProducts)

    if (findProducts.length === 0) {
        return null
    }

    // Store order in conversation state
    if (!conversationState) {
        conversationState = {
            userId: event.source?.userId || '',
            storeId: storeProfile.id,
            orderType: 'cart',
            isBotEnabled: true,
            lastInteraction: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        }
    }

    conversationState.currentOrder = {
        items: findProducts,
        deliveryAddress: args.delivery_address,
        customerName: event.profile.displayName || '',
    }
    await setConversationState(conversationState)
    console.log('conversationState in place_order ->', conversationState)

    return null
}

async function edit_items(
    args: EditArgs,
    event: any,
    storeProfile: any
): Promise<BotResponse | null> {
    let conversationState = await getConversationState(
        event.source?.userId || '',
        storeProfile.id
    )

    if (!conversationState?.currentOrder?.items) {
        return {
            success: false,
            error: {
                message: 'ไม่พบคำสั่งซื้อ',
            },
        }
    }

    // Handle each modification
    args.modifications.forEach((mod: any) => {
        const existingItems = conversationState.currentOrder?.items || []
        const key = `${mod.name}-${mod.customization || ''}`

        switch (mod.operation) {
            case 'add':
                console.log('add')
                // return
                // Find existing item
                const existingItem = existingItems.find(
                    (item: any) => item.name === mod.name
                )

                if (existingItem) {
                    // Update quantity if item exists
                    existingItem.quantity += mod.quantity
                    existingItem.customization = mod.customization
                } else {
                    // Add new item
                    const product = storeProfile.product.find(
                        (p: any) => p.name === mod.name
                    )
                    if (product) {
                        existingItems.push({
                            name: mod.name,
                            quantity: mod.quantity,
                            customization: mod.customization,
                            price: product.price,
                        })
                    }
                }
                break

            case 'remove':
                // Remove item if exists
                const removeIndex = existingItems.findIndex(
                    (item: any) => item.name === mod.name
                )
                if (removeIndex !== -1) {
                    existingItems.splice(removeIndex, 1)
                }
                break

            case 'replace':
                // Replace item if exists
                const replaceIndex = existingItems.findIndex(
                    (item: any) => item.name === mod.name
                )
                if (replaceIndex !== -1) {
                    const product = storeProfile.product.find(
                        (p: any) => p.name === mod.replacement_name
                    )
                    if (product) {
                        existingItems[replaceIndex] = {
                            name: mod.replacement_name,
                            quantity: mod.replacement_quantity || 1,
                            customization: mod.customization,
                            price: product.price,
                        }
                    }
                }
                break
        }
    })

    // Update conversation state
    await setConversationState(conversationState)

    return null
}

async function edit_address(
    args: { new_address: string },
    event: any,
    storeProfile: any
): Promise<BotResponse | null> {
    // Get current conversation state
    let conversationState = await getConversationState(
        event.source?.userId || '',
        storeProfile.id
    )

    if (!conversationState?.currentOrder) {
        return {
            success: false,
            error: {
                message: 'ไม่พบคำสั่งซื้อสำหรับแก้ไขที่อยู่จัดส่ง',
            },
        }
    }
    const tempAddress = conversationState.currentOrder.deliveryAddress
    // Update delivery address in conversation state
    conversationState.currentOrder.deliveryAddress = args.new_address
    await setConversationState(conversationState)

    return {
        success: true,
        data: {
            message:
                'ที่อยู่จัดส่งถูกแก้ไขเรียบร้อยจาก ' +
                tempAddress +
                ' เป็น ' +
                args.new_address,
        },
    }
}

async function get_product(
    args: ProductArgs,
    event: any,
    storeProfile: any
): Promise<BotResponse | null> {
    if (args.operation === 'search') {
        const product = storeProfile.product.find(
            (p: any) => p.name === args.query
        )
        return product
    }
    return null
}

// Add QR code scanning function
async function scanQRCode(imageBuffer: Buffer): Promise<string | null> {
    try {
        // Create a canvas and load the image
        const canvas = createCanvas(800, 600)
        const ctx = canvas.getContext('2d')
        const image = await loadImage(imageBuffer)

        // Draw image on canvas
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Decode QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
            // Extract refNbr from QR code data
            return code.data
        }
        return null
    } catch (error) {
        console.error('Error scanning QR code:', error)
        return null
    }
}
