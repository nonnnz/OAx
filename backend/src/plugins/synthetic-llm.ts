// src/plugins/synthetic-llm.test.ts

// --- ส่วน import และ mock ทั้งหมด คงไว้เหมือนเดิม ---
import { callBotWithLangChain } from './llm-testing'
import { performance } from 'perf_hooks'

// Mock Redis
jest.mock('../lib/redis', () => ({
    get: jest
        .fn()
        .mockImplementation(async (key: string) => redisStore[key] || null),
    setex: jest
        .fn()
        .mockImplementation(
            async (key: string, _ttl: number, value: string) => {
                redisStore[key] = value
            }
        ),
}))
let redisStore: { [key: string]: string } = {}

//--- โครงสร้างของ Jest ---
describe('Synthetic LLM Test for Thai Food Ordering Bot', () => {
    // ใช้ beforeEach เพื่อล้างค่า redisStore ก่อนรันแต่ละเทสย่อย
    beforeEach(() => {
        redisStore = {}
    })

    // 'test' หรือ 'it' คือเทสเคส 1 กรณี
    it('should correctly handle a full conversation flow for multiple customers', async () => {
        // --- ย้าย Mock Data Setup มาไว้ข้างในนี้ ---
        const mockStoreProfile = {
            id: 'store-001',
            product: [
                { id: 'p-01', name: 'ข้าวผัดกุ้ง', price: 60 },
                { id: 'p-02', name: 'คะน้าหมูกรอบ', price: 55 },
                { id: 'p-03', name: 'กะเพราหมูกรอบ', price: 55 },
                { id: 'p-04', name: 'สุกี้แห้งทะเล', price: 70 },
                { id: 'p-05', name: 'โค้กซีโร่', price: 15 },
                { id: 'p-06', name: 'ข้าวขาหมูพิเศษ', price: 65 },
            ],
        }

        const testScenarios = [
            // --- ลูกค้าคนที่ 1: ลูกค้าลังเล เปลี่ยนใจเก่ง ---
            {
                customer: 'ลูกค้า 1 (เปลี่ยนใจเก่ง)',
                userId: 'user-001',
                displayName: 'สมชาย',
                prompt: 'เอาข้าวผัดกุ้ง 1 จาน กับคะน้าหมูกรอบอีก 1 ครับ ส่งที่ มจพ. ประตูฝั่งพระราม 7',
                expectedFunction: 'place_order',
            },
            {
                customer: 'ลูกค้า 1 (เปลี่ยนใจเก่ง)',
                userId: 'user-001',
                displayName: 'สมชาย',
                prompt: 'เปลี่ยนที่ส่งเป็นคอนโดรีเจ้นท์โฮม บางซ่อน ตึก A',
                expectedFunction: 'edit_address',
            },
            {
                customer: 'ลูกค้า 1 (เปลี่ยนใจเก่ง)',
                userId: 'user-001',
                displayName: 'สมชาย',
                prompt: 'คิดไปคิดมา ข้าวผัดกุ้งไม่เอาดีกว่าครับ ขอเปลี่ยนเป็นกะเพราหมูกรอบ 2 กล่องแทน',
                expectedFunction: 'edit_items',
            },
            // --- ลูกค้าคนที่ 2: สั่งเพิ่ม แล้วยกเลิก ---
            {
                customer: 'ลูกค้า 2 (สั่งเพิ่ม/ยกเลิก)',
                userId: 'user-002',
                displayName: 'สมหญิง',
                prompt: 'สั่งสุกี้แห้งทะเล 1 ที่ครับ ส่ง SCG บางซื่อ',
                expectedFunction: 'place_order',
            },
            {
                customer: 'ลูกค้า 2 (สั่งเพิ่ม/ยกเลิก)',
                userId: 'user-002',
                displayName: 'สมหญิง',
                prompt: 'พี่ครับ ขอเพิ่มโค้กซีโร่ 2 กระป๋องด้วยครับ',
                expectedFunction: 'edit_items',
            },
            {
                customer: 'ลูกค้า 2 (สั่งเพิ่ม/ยกเลิก)',
                userId: 'user-002',
                displayName: 'สมหญิง',
                prompt: 'ขอยกเลิกออเดอร์ทั้งหมดก่อนนะครับ พอดีมีประชุมด่วนเข้ามา',
                expectedFunction: 'cancel_order',
            },
            // --- ลูกค้าคนที่ 3: ช่างสงสัย และแจ้งปัญหา ---
            {
                customer: 'ลูกค้า 3 (สอบถาม/แจ้งปัญหา)',
                userId: 'user-003',
                displayName: 'สมศักดิ์',
                prompt: 'ที่ร้านมีเมนูอะไรขายดีบ้างครับ',
                expectedFunction: 'get_product',
            },
            {
                customer: 'ลูกค้า 3 (สอบถาม/แจ้งปัญหา)',
                userId: 'user-003',
                displayName: 'สมศักดิ์',
                prompt: 'โอเค งั้นเอาข้าวขาหมูพิเศษ 1 กล่องครับ ส่งที่อาคารเมืองไทยภัทร',
                expectedFunction: 'place_order',
            },
            {
                customer: 'ลูกค้า 3 (สอบถาม/แจ้งปัญหา)',
                userId: 'user-003',
                displayName: 'สมศักดิ์',
                prompt: 'ทำไมนานจังเลยครับ อาหารได้รึยังครับ',
                expectedFunction: 'report_issue',
            },
        ]

        // --- ย้าย Test Runner Logic มาไว้ข้างในนี้ ---
        const results = []
        console.log(
            '=============== เริ่มการทดสอบ Synthetic Data ==============='
        )

        for (let i = 0; i < testScenarios.length; i++) {
            const scenario = testScenarios[i]
            const mockEvent = {
                message: { text: scenario.prompt },
                source: { userId: scenario.userId },
                profile: { displayName: scenario.displayName },
            }

            const startTime = performance.now()
            console.log(`กำลังทดสอบ: ${scenario.customer} - ${scenario.prompt}`)
            const [toolName, response] = await callBotWithLangChain(
                mockEvent,
                mockStoreProfile
            )
            const endTime = performance.now()
            const duration = Math.round(endTime - startTime)

            // ใช้ expect ของ Jest ในการยืนยันผล
            expect(toolName).toBe(scenario.expectedFunction)

            results.push({
                id: i + 1,
                prompt: scenario.prompt,
                expected: scenario.expectedFunction,
                actual: toolName,
                success:
                    toolName === scenario.expectedFunction
                        ? '✅ สำเร็จ'
                        : '❌ ผิดพลาด',
                duration: `${duration} ms`,
            })
        }

        // --- สรุปผลลัพธ์เป็นตาราง ---
        console.log('\n\n=============== สรุปผลการทดสอบ ===============')
        console.table(
            results.map((r) => ({
                ลำดับ: r.id,
                'สถานการณ์ / Prompt': r.prompt,
                'Function ที่คาดหวัง': r.expected,
                'Function ที่ได้รับ': r.actual,
                ผลลัพธ์: r.success,
                เวลาที่ใช้: r.duration,
            }))
        )
    }, 30000) // เพิ่ม Timeout ให้ Jest รอเทสที่อาจจะนานได้ถึง 30 วินาที
})
