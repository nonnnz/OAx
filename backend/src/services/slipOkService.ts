import { PrismaClient } from '@prisma/client'

interface SlipOkRequest {
    data: string
    amount: string
}

interface SlipOkResponse {
    success: boolean
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

export class SlipOkService {
    private readonly apiUrl = process.env.SLIPOK_URL || ''
    private readonly prisma: PrismaClient
    private readonly apiKey: string

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('SlipOk API key is required')
        }
        this.apiKey = apiKey
        this.prisma = new PrismaClient()
    }

    async verifySlip(
        refNbr: string,
        amount: string,
        transactionId: string
    ): Promise<SlipOkResponse> {
        try {
            // Validate input parameters
            if (!refNbr) {
                throw new Error('Reference number is required')
            }

            if (
                !amount ||
                isNaN(parseFloat(amount)) ||
                parseFloat(amount) <= 0
            ) {
                throw new Error('Invalid amount. Must be a positive number.')
            }

            if (!transactionId) {
                throw new Error('Transaction ID is required')
            }

            const requestData: SlipOkRequest = {
                data: refNbr,
                amount,
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-authorization': this.apiKey,
                },
                body: JSON.stringify(requestData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'API request failed')
            }

            // If successful, create a new slip record in the database
            if (data.success && data.data.success) {
                await this.prisma.slip.create({
                    data: {
                        success: data.data.success,
                        statusMessage: data.data.message,
                        receivingBank: data.data.receivingBank,
                        sendingBank: data.data.sendingBank,
                        transDate: data.data.transDate,
                        transTime: data.data.transTime,
                        sender: {
                            displayName: data.data.sender.displayName,
                            name: data.data.sender.name,
                            account: {
                                value: data.data.sender.account.value,
                            },
                        },
                        receiver: {
                            displayName: data.data.receiver.displayName,
                            name: data.data.receiver.name,
                            account: {
                                value: data.data.receiver.account.value,
                            },
                        },
                        amount: data.data.amount,
                        isConfirmed: true,
                        transaction: {
                            connect: {
                                id: transactionId,
                            },
                        },
                    },
                })
            }

            return data
        } catch (error) {
            console.error('SlipOk API error:', error)
            throw error
        }
    }
}
