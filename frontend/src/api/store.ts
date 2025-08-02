import {
  Store,
  CreateStore,
  Account,
  Product,
  // CreateProduct,
  // UpdateProduct,
  Receipt,
  CreateReceipt,
  UpdateReceipt,
  Order,
  UpdateOrder,
  // PaginatedResponse,
  ApiResponse,
  Ingredient,
  UpdateIngredient,
  VerifySlipResponse,
  OCRResponse,
  PaginatedProductResponse,
  PaginatedIngredientResponse,
  PaginatedOrderResponse,
  Transaction,
  PaginatedTransactionResponse,
  PaginatedStoreResponse,
  PaginatedReceiptResponse,
  StoreStats,
} from "@/types"
import { useLiffStore } from "@/stores/liffStore"

const API_URL = import.meta.env.VITE_API_URL

// Helper function to get headers
const getHeaders = (isMultipart = false) => {
  const headers: Record<string, string> = {}
  const accessToken = useLiffStore.getState().accessToken

  if (accessToken) {
    headers.authorization = "Bearer " + accessToken
  }

  if (!isMultipart) {
    headers["Content-Type"] = "application/json"
  }

  return headers
}

// Store API functions
export const getStore = async (
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedStoreResponse<Store>>> => {
  const params = new URLSearchParams()
  if (page) params.append("page", page.toString())
  if (limit) params.append("limit", limit.toString())

  const response = await fetch(`${API_URL}/api/v1/store?${params}`, {
    headers: getHeaders(),
  })

  return response.json()
}

export const getStoreByID = async (id: string): Promise<ApiResponse<Store>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${id}`, {
    headers: getHeaders(),
  })
  return response.json()
}

export const createStore = async (
  store: CreateStore,
): Promise<ApiResponse<Store>> => {
  const response = await fetch(`${API_URL}/api/v1/store`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(store),
  })
  console.log(response)
  return response.json()
}

export const updateStore = async (
  id: string,
  store: Partial<Store>,
): Promise<ApiResponse<Store>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(store),
  })
  return response.json()
}

export const deleteStore = async (id: string): Promise<ApiResponse<null>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  })
  return response.json()
}

export const getAllStores = async (
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedStoreResponse<Store>>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/all?page=${page}&limit=${limit}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

// Store Accounts API
export const updateStoreAccounts = async (
  storeId: string,
  accounts: Account[],
): Promise<ApiResponse<Store>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${storeId}/accounts`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ accounts }),
  })
  return response.json()
}

export const deleteStoreAccount = async (
  storeId: string,
  accountIndex: number,
): Promise<ApiResponse<Store>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/accounts/${accountIndex}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
  )
  return response.json()
}

// Store Line OA Bot API
export const updateStoreLineOABot = async (
  storeId: string,
  lineOABot: { channelSecret: string; channelAccessToken: string },
): Promise<ApiResponse<Store>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/line-oabot`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(lineOABot),
    },
  )
  return response.json()
}

// Store Products API
export const getStoreProducts = async (
  storeId: string,
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedProductResponse<Product>>> => {
  const params = new URLSearchParams()
  if (page) params.append("page", page.toString())
  if (limit) params.append("limit", limit.toString())

  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/products?${params}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const getStoreProduct = async (
  storeId: string,
  productId: string,
): Promise<ApiResponse<Product>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/products/${productId}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const createStoreProduct = async (
  storeId: string,
  product: FormData,
): Promise<ApiResponse<Product>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${storeId}/products`, {
    method: "POST",
    headers: getHeaders(true),
    body: product,
  })
  return response.json()
}

export const updateStoreProduct = async (
  storeId: string,
  productId: string,
  product: FormData,
): Promise<ApiResponse<Product>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/products/${productId}`,
    {
      method: "PATCH",
      headers: getHeaders(true),
      body: product,
    },
  )
  return response.json()
}

export const deleteStoreProduct = async (
  storeId: string,
  productId: string,
): Promise<ApiResponse<null>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/products/${productId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
  )
  return response.json()
}

// Store Ingredients API
export const getStoreIngredients = async (
  storeId: string,
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedIngredientResponse<Ingredient>>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/ingredient?page=${page}&limit=${limit}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const getStoreIngredient = async (
  storeId: string,
  ingredientId: string,
): Promise<ApiResponse<Ingredient>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/ingredient/${ingredientId}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const updateStoreIngredient = async (
  storeId: string,
  ingredientId: string,
  ingredient: UpdateIngredient,
): Promise<ApiResponse<Ingredient>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/ingredient/${ingredientId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(ingredient),
    },
  )
  return response.json()
}

export const deleteStoreIngredient = async (
  storeId: string,
  ingredientId: string,
): Promise<ApiResponse<null>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/ingredient/${ingredientId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
  )
  return response.json()
}

// Store Receipts API
export const getStoreReceipts = async (
  storeId: string,
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedReceiptResponse<Receipt>>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/receipt?page=${page}&limit=${limit}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const getStoreReceipt = async (
  storeId: string,
  receiptId: string,
): Promise<ApiResponse<Receipt>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/receipt/${receiptId}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const createStoreReceipt = async (
  storeId: string,
  receipt: CreateReceipt,
): Promise<ApiResponse<Receipt>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${storeId}/receipt`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(receipt),
  })
  return response.json()
}

export const uploadReceiptImage = async (
  storeId: string,
  receiptId: string,
  image: FormData,
): Promise<ApiResponse<Receipt>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/receipt/${receiptId}/upload-image`,
    {
      method: "POST",
      headers: getHeaders(true),
      body: image,
    },
  )
  return response.json()
}

export const updateStoreReceipt = async (
  storeId: string,
  receiptId: string,
  receipt: UpdateReceipt,
  ingredientId?: string,
): Promise<ApiResponse<Receipt>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/receipt/${receiptId}/${ingredientId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(receipt),
    },
  )
  return response.json()
}

export const deleteStoreReceipt = async (
  storeId: string,
  receiptId: string,
): Promise<ApiResponse<null>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/receipt/${receiptId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
  )
  return response.json()
}

// Store Orders API
export const getStoreOrders = async (
  storeId: string,
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedOrderResponse<Order>>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/orders?page=${page}&limit=${limit}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const getStoreOrder = async (
  storeId: string,
  orderId: string,
): Promise<ApiResponse<Order>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/orders/${orderId}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

export const updateStoreOrder = async (
  storeId: string,
  orderId: string,
  order: UpdateOrder,
): Promise<ApiResponse<Order>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/orders/${orderId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(order),
    },
  )
  return response.json()
}

// Store Transactions API
export const getStoreTransactions = async (
  storeId: string,
  page?: number,
  limit?: number,
): Promise<ApiResponse<PaginatedTransactionResponse<Transaction>>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/transactions?page=${page}&limit=${limit}`,
    {
      headers: getHeaders(),
    },
  )
  return response.json()
}

// update transaction by orderID
export const updateTransactionByOrderID = async (
  storeId: string,
  orderId: string,
  status: string,
): Promise<ApiResponse<Transaction>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/orders/${orderId}/transactions`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    },
  )
  return response.json()
}

// External API
export const verifySlip = async (
  storeId: string,
  data: { image: string },
): Promise<ApiResponse<VerifySlipResponse>> => {
  const response = await fetch(
    `${API_URL}/api/v1/store/${storeId}/verify-slip`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    },
  )
  return response.json()
}

export const ocr = async (
  storeId: string,
  image: FormData,
): Promise<ApiResponse<OCRResponse>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${storeId}/ocr`, {
    method: "POST",
    headers: getHeaders(true),
    body: image,
  })
  return response.json()
}

// stats
export const getStoreStats = async (
  storeId: string,
): Promise<ApiResponse<StoreStats>> => {
  const response = await fetch(`${API_URL}/api/v1/store/${storeId}/stats`, {
    headers: getHeaders(),
  })
  return response.json()
}
