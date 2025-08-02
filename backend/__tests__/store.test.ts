import { describe, it, expect } from 'bun:test'
import { extractAccountInfo } from '../src/lib/ocr'

describe('Store Functions', () => {
    describe('extractAccountInfo', () => {
        const mockAccounts = [
            {
                receiverType: 'BANK',
                receiverAccount: '123-4-5678-9',
                receiverBank: 'KBANK',
                accountNameTh: 'นายทดสอบ ทดสอบ',
                accountNameEn: 'Mr. Test Test',
                promptpayId: '',
            },
        ]

        it('should extract account info from valid text', () => {
            const text = `Transfer Completed ง 1< +
                21 Mar 25 10:06 PM ญ
                ) &
                MR. Test Test ” nd ก \
                KBank La,
                sid ey N32 อ
                XXX X X2107 x [EI Vs ๒
                เอ
                MS SUWISA KAITAE \% aa A
                Prompt 2
                Sal PromptPay ID b » ณ์ะ ลื๊
                X XXXX XXXX6 00 5 pr 4 \ ~~ pr rt
                Transaction ID: 4#.๒5 er
                015080220625CPP02948 ” [m]3 ห: [ๆ
                วัวิ 5ววูสรสส L 5 un ซู ial ะอ
                Amount: ไซ a
                74.00 Baht (LIT gop:
                รว Fre lis
                Fee: [ ] 2 ZX
                0.00 Baht Scan for Verify Slip confidence: 53`

            const result = extractAccountInfo(text, mockAccounts)
            expect(result).toEqual({
                type: 'BANK',
                value: '123-4-5678-9',
                receiverName: 'นายทดสอบ ทดสอบ',
                receiverNameEn: 'Mr. Test Test',
            })
        })

        // it('should handle text with only amount', () => {
        //     const text = 'Amount: 500'
        //     const result = extractAccountInfo(text, mockAccounts)
        //     expect(result).toEqual({
        //         type: 'BANK',
        //         value: '123-4-5678-9',
        //         receiverName: 'นายทดสอบ ทดสอบ',
        //         receiverNameEn: 'Mr. Test Test',
        //         amount: 500,
        //     })
        // })

        // it('should handle text with no amount', () => {
        //     const text = 'ชื่อผู้รับ: นายทดสอบ ทดสอบ'
        //     const result = extractAccountInfo(text, mockAccounts)
        //     expect(result).toEqual({
        //         type: 'BANK',
        //         value: '123-4-5678-9',
        //         receiverName: 'นายทดสอบ ทดสอบ',
        //         receiverNameEn: 'Mr. Test Test',
        //     })
        // })

        // it('should return null for text with no matching account', () => {
        //     const text = 'ชื่อผู้รับ: ไม่มีในระบบ'
        //     const result = extractAccountInfo(text, mockAccounts)
        //     expect(result).toBeNull()
        // })
    })
})
