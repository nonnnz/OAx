import { createWorker } from 'tesseract.js'
import sharp from 'sharp'
import { Account } from '../types'

// Worker cache to avoid recreating workers
const workerCache = new Map()

// Optimize image for better OCR results
export async function optimizeImage(imageBuffer: Buffer) {
    return await sharp(imageBuffer)
        .grayscale() // Convert to grayscale for better text recognition
        .normalize() // Normalize the image to improve contrast
        .sharpen() // Sharpen for better text clarity
        .withMetadata() // Preserve metadata
        .toBuffer()
}

export async function performOCR(imageBuffer: Buffer) {
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
        return { text: cleanOcrText(text), confidence }
    } catch (error) {
        console.error('Tesseract recognition error:', error)
        throw new Error('Failed to recognize text from image')
    }
}

function cleanOcrText(text: string) {
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

// Clean up workers on shutdown
process.on('SIGINT', async () => {
    for (const worker of workerCache.values()) {
        await worker.terminate()
    }
    process.exit(0)
})
