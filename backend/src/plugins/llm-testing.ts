import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { transformResponse } from '../lib/utils'
import redis from '../lib/redis'

// import { StoreProfile } from '../types'

// Add type definitions at the top of the file
export type BotResponse = {
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
        baseURL: 'https://ollama-qwen-422995111688.asia-southeast1.run.app',
        apiKey: 'ollama',
        models: ['qwen3:4b'],
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
let currentModelIndex = 0

// Update ConversationState type to include cart functionality
export type ConversationState = {
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

// Add conversation state management functions
export async function getConversationState(
    userId: string,
    storeId: string
): Promise<ConversationState | undefined> {
    const key = getConversationKey(userId, storeId)
    const data = await redis.get(key)
    if (!data) return undefined
    return JSON.parse(data)
}

export async function setConversationState(state: ConversationState) {
    const key = getConversationKey(state.userId, state.storeId)
    // Ensure expiresAt is a Date object
    const expiresAt =
        state.expiresAt instanceof Date
            ? state.expiresAt
            : new Date(state.expiresAt)
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    await redis.setex(key, ttl, JSON.stringify(state))
}

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

async function callBot(
    event: any,
    storeProfile: any
): Promise<[string, BotResponse | null]> {
    const prompt = event.message.text

    if (event.message?.text?.toLowerCase() === 'enable_bot') {
        return ['enable_bot', null]
    }
    return callBotWithLangChain(event, storeProfile)
}

function addTokens(a, b) {
    return {
        inputTokens: a.inputTokens + b.inputTokens,
        outputTokens: a.outputTokens + b.outputTokens,
        totalTokens: a.totalTokens + b.totalTokens,
    }
}

export async function callBotWithLangChain(
    event: any,
    storeProfile: any
): Promise<
    [
        string,
        BotResponse | null,
        {
            inputTokens: number
            outputTokens: number
            totalTokens: number
        } | null
    ]
> {
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
        // view prompt
        console.log('prompt:', prompt)
        console.log('currentOrder:', placeConversationState_show?.currentOrder)
        const schemaEnd = new Date()
        console.log(
            'time taken:',
            schemaEnd.getTime() - schemaStart.getTime(),
            'ms'
        )

        let toolName: any

        if (resultFromIdentification.tool_calls?.[0]) {
            toolName = resultFromIdentification.tool_calls?.[0].name
            console.log('toolName:', toolName)
        }
        if (!toolName) {
            console.log('No tool identified.')
            return ['not_understood', null]
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
        console.log('resultFromTool:', resultFromTool)

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

        let [inputTokens, outputTokens, totalTokens] = [0, 0, 0]

        console.log('resultFromIdentification:', resultFromIdentification)

        if (resultFromIdentification.usage_metadata) {
            inputTokens += resultFromIdentification.usage_metadata?.input_tokens
            outputTokens +=
                resultFromIdentification.usage_metadata?.output_tokens
            totalTokens += resultFromIdentification.usage_metadata?.total_tokens
        }

        if (resultFromTool.usage_metadata) {
            inputTokens += resultFromTool.usage_metadata?.input_tokens
            outputTokens += resultFromTool.usage_metadata?.output_tokens
            totalTokens += resultFromTool.usage_metadata?.total_tokens
        }

        return [
            responseFormat.toolName,
            response,
            { inputTokens, outputTokens, totalTokens },
        ]
    } catch (error) {
        console.error('Error in LangChain implementation:', error)
        return ['', null, { inputTokens: 0, outputTokens: 0, totalTokens: 0 }]
    }
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
