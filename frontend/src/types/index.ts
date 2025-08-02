// Types based on the provided schema
export enum OpeningStatus {
  OPEN = "OPEN",
  OPEN_WITH_TIME = "OPEN_WITH_TIME",
  CLOSE = "CLOSE",
}

export enum DayOfWeek {
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
  SUNDAY = "SUNDAY",
}

export interface OpeningHour {
  dayOfWeek: DayOfWeek
  openingTime: string
  closingTime: string
  closed: boolean
}

export interface Account {
  receiverType: string
  receiverAccount?: string | null
  receiverBank?: string | null
  accountNameTh: string
  accountNameEn: string
  promptpayId?: string | null
}

export interface LineOABot {
  botId: string
  basicId: string
  displayName: string
  channelSecret: string
  channelAccessToken: string
}

export interface Store {
  id: string
  storeName: string
  phone: string
  address: string
  isCash: boolean
  openingStatus: string
  openingHours: OpeningHour[]
  accounts: Account[]
  lineOABot: LineOABot
}

export interface CreateStore {
  storeName: string
  phone: string
  address: string
  isCash: boolean
  openingStatus: string
  openingHours: OpeningHour[]
  accounts: Account[]
  lineOABot: LineOABot
}

export interface StoreResponse {
  store: Store
  message: string
}

// Product Types
export interface IngredientInfo {
  ingredientId: string
  ingredientName: string
  ingredientQuantity: number
  ingredientUnit: string
}

export interface ReceiptInfo {
  receiptId: string
  quantity: number
  customUnit?: string | null
  originalQuantity: number
  price: number
  quantityUsed: number
  receiptUsedOrder: ReceiptUsedOrder[]
  isActive: boolean
}

export interface ReceiptUsedOrder {
  orderId: string
  quantity: number
  price: number
}

export interface Ingredient {
  id: string
  name: string
  quantity: number
  unit: string
  productIDs?: string[]
  receiptIDs?: string[]
  receiptInfo?: ReceiptInfo[]
  receipts?: Receipt[]
  createdAt?: string
  updatedAt?: string
}

export interface Product {
  id: string
  name: string
  imageUrl?: string
  description?: string
  price: number
  ingredientInfo?: IngredientInfo[]
  ingredientIDs?: string[]
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateProduct {
  name: string
  description?: string
  price: number
  ingredientInfo?: IngredientInfo[]
  ingredient?: Ingredient[]
  image?: File
}

export interface UpdateProduct extends Partial<CreateProduct> {
  isActive?: boolean
}

// Receipt Types
export interface ReceiptProduct {
  pdId: string
  quantity: number
  isEdit: boolean
}

export interface ReceiptIngredient {
  name: string
  unit: string
  quantity: number
  ingId: string
  products: ReceiptProduct[]
  price: number
}

export interface Receipt {
  id: string
  imageUrl?: string
  store: string
  receiptsRef: string
  receiptsDate: string
  ingredients: ReceiptIngredient[]
  createdAt?: string
  updatedAt?: string
}

export interface CreateReceipt {
  imageUrl?: string
  store: string
  receiptsRef: string
  receiptsDate: string
  ingredients: ReceiptIngredient[]
}

export type UpdateReceipt = {
  isActive?: boolean
}

// Order Types
export interface OrderProductInfo {
  productId: string
  name: string
  quantity: number
  price: number
  customization?: string
}

export interface Order {
  id: string
  customerLineId: string
  customerName: string
  customerAdds: string
  productInfo: OrderProductInfo[]
  status: string
  createdAt?: string
  updatedAt?: string
}

export interface UpdateOrder {
  customerLineId?: string
  customerName?: string
  customerAdds?: string
  productInfo?: OrderProductInfo[]
  status?: string
}

// API Response Types
export interface PaginatedResponse {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface PaginatedStoreResponse<T> {
  stores: T[]
  pagination: PaginatedResponse
}

export interface PaginatedTransactionResponse<T> {
  transactions: T[]
  pagination: PaginatedResponse
}

export interface PaginatedOrderResponse<T> {
  orders: T[]
  pagination: PaginatedResponse
}

export interface PaginatedProductResponse<T> {
  products: T[]
  pagination: PaginatedResponse
}

export interface PaginatedIngredientResponse<T> {
  ingredients: T[]
  pagination: PaginatedResponse
}

export interface PaginatedReceiptResponse<T> {
  receipts: T[]
  pagination: PaginatedResponse
}

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

// Ingredient Types
export interface UpdateIngredient {
  name?: string
  unit?: string
}

export interface StoreStats {
  totalOrders: number
  totalSales: number
  averageOrderValue: number
  productStats: ProductStats[]
  dailySales: DailySales[]
}

export interface ProductStats {
  productId: string
  name: string
  totalSale: number
  totalOrders: number
}

export interface DailySales {
  date: string
  totalSales: number
  totalOrders: number
}

// External API Response Types
export interface VerifySlipResponse {
  text: string
  confidence: number
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
}

/*
example OCR response

 {
    "path": "public/ocr/67bec698b9483827dcf0c05a.png",
    "ocrText": "22:15 al © ED\n< รายการสั่งซือที่ร้านและ 7Delivery\n11/03/68 19:48\nเลขที่ใบเสร็จ 1000055040\n[1 ศาขา 7 Eleven พินบูลย์สงคราม 22 (สีริน...\nรหัสร้าน : 16401\nรายการสินค้า\n2 สโมกกี้พินเบคอน(หมู๑@๑26.009 52.00\n1 แดจี่โกลด์มอสชาเร 25.00\n2 วอลสล์โมร7 มิลค์ก็ @๑20.00 40.00\n10 Delivery Servi @0.00 0.00N\nยอดรวม 117.00\n1 ส้วนลดไอศกรีมวอลล์ AW 10.00\n1 ส้วนลดแดรี่โกลด์ Ba ด. 4.00\n1 “๒8ลดไอศกรีมวอลล์ AW 1.00\n2 ส้วนลดสโมกกัพินเบคอน 14.00\n1 TMWamnloAndul9aa AW 1.00\nยอดสูทธิ 15 Hu 87.00\nnsooaLan7App 87.00\nTID#16401250311494214194844\nR#1000055040P1 :S1640144 11/03/68 19:48\n* ศูนย์บริการสมาชิก All Member 0 2826 7777\n** PayAtAll by Counter Service %%\nขอใบกํากับภาษีอิเล็กทรอนิกส์\nออูอูิมุ๑ฐฐจบจ%ูะตุ",
    "ocrConfidence": 88,
    "extractedData": {
      "items": [
        {
          "confidence": 0.95,
          "description": "สโมกกี้พันเบคอน (หมู)",
          "quantity": 2,
          "unit_price": 26,
          "total_price": 52
        },
        {
          "confidence": 0.98,
          "description": "แดรี่โกลด์มอสชาเร",
          "quantity": 1,
          "unit_price": 25,
          "total_price": 25
        },
        {
          "confidence": 0.75,
          "description": "วอลล์โมร7 มิลค์",
          "quantity": 2,
          "unit_price": 20,
          "total_price": 40
        },
        {
          "confidence": 0.99,
          "description": "Delivery Servi",
          "quantity": 10,
          "unit_price": 0,
          "total_price": 0
        },
        {
          "confidence": 0.9,
          "description": "ส่วนลดไอศกรีมวอลล์ AW",
          "quantity": 1,
          "unit_price": 10,
          "total_price": 10
        },
        {
          "confidence": 0.9,
          "description": "ส่วนลดแดรี่โกลด์ Ba",
          "quantity": 1,
          "unit_price": 4,
          "total_price": 4
        },
        {
          "confidence": 0.9,
          "description": "ส่วนลดไอศกรีมวอลล์ AW",
          "quantity": 1,
          "unit_price": 1,
          "total_price": 1
        },
        {
          "confidence": 0.9,
          "description": "ส่วนลดสโมกกี้พันเบคอน",
          "quantity": 2,
          "unit_price": 14,
          "total_price": 28
        },
        {
          "confidence": 0.75,
          "description": "TMWamnloAndul9aa AW",
          "quantity": 1,
          "unit_price": 1,
          "total_price": 1
        }
      ],
      "merchant_name": "7 Eleven",
      "receipt_number": "1000055040",
      "transaction_date": "11/03/68 19:48"
    }

*/

export interface OCRResponse {
  path: string
  ocrText?: string
  ocrConfidence?: number
  extractedData: {
    items: Array<{
      confidence: number
      description: string
      quantity: number
      unit_price: number
      total_price: number
      unit: string
    }>
    merchant_name: string
    receipt_number: string
    transaction_date: string
  }
}

export interface AccountInfo {
  value: string
}

export interface SenderReceiverInfo {
  displayName: string
  name: string
  account: AccountInfo
}

export interface Slip {
  id: string
  success: boolean
  statusMessage: string
  receivingBank: string
  sendingBank: string
  transDate: string
  transTime: string
  sender: SenderReceiverInfo
  receiver: SenderReceiverInfo
  amount: number
  isConfirmed: boolean
  createdAt: string
  updatedAt: string
  transactionId: string
}

export interface Transaction {
  id: string
  slip: Slip[]
  totalAmount: number
  paymentMethod: string | null
  order: Order
  orderId: string
  createdAt: string
  updatedAt: string
  isConfirmed: boolean
}
