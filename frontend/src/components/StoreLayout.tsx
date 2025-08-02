"use client"

import { useState, useEffect } from "react"
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom"
import { Store, Package, ShoppingBag, FileText, ScanLine } from "lucide-react"
import { cn } from "../lib/utils"
import type { Store as StoreType } from "@/types"
import Topbar from "@/components/topbar"

// Mock function to get store data
const getStoreData = async (storeId: string): Promise<StoreType> => {
  // In a real app, this would fetch from an API
  return {
    id: storeId,
    storeName: "Coffee Shop",
    phone: "123-456-7890",
    address: "123 Main St",
    isCash: true,
    openingStatus: "OPEN",
    openingHours: [],
    accounts: [],
    lineOABot: {
      botId: "bot123",
      basicId: "basic123",
      displayName: "Coffee Bot",
      channelSecret: "secret123",
      channelAccessToken: "token123",
    },
  }
}

export default function StoreLayout() {
  const { storeId } = useParams<{ storeId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [store, setStore] = useState<StoreType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("storeId", storeId)
    const fetchStore = async () => {
      if (storeId) {
        try {
          const storeData = await getStoreData(storeId)
          setStore(storeData)
        } catch (error) {
          console.error("Failed to fetch store:", error)
        } finally {
          setLoading(false)
        }
      }
    }

    fetchStore()
  }, [storeId])

  const navigation = [
    {
      name: "ร้านค้า",
      href: `/store/${storeId}`,
      icon: Store,
      current: location.pathname === `/store/${storeId}`,
    },
    {
      name: "สินค้า",
      href: `/store/${storeId}/products`,
      icon: Package,
      current: location.pathname === `/store/${storeId}/products`,
    },
    {
      name: "คำสั่งซื้อ",
      href: `/store/${storeId}/orders`,
      icon: ShoppingBag,
      current: location.pathname === `/store/${storeId}/orders`,
    },
    {
      name: "แสกนบิล",
      href: `/store/${storeId}/ocr`,
      icon: ScanLine,
      current: location.pathname === `/store/${storeId}/ocr`,
    },
    {
      name: "รายงาน",
      href: `/store/${storeId}/reports`,
      icon: FileText,
      current: location.pathname === `/store/${storeId}/reports`,
    },
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex h-screen items-center justify-center">
        Store not found
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Bar */}
      <Topbar />

      {/* Main content */}
      <div className="flex-1 pb-16">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <div className="bg-background fixed bottom-0 left-0 z-50 w-full border-t">
        <div className="mx-auto grid h-20 max-w-lg grid-cols-5">
          {navigation.map((item) =>
            item.name === "คำสั่งซื้อ" ? (
              <div
                className="flex flex-col items-center justify-center gap-1"
                key={item.name}
              >
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "group bg-primary inline-flex h-12 w-12 flex-col items-center justify-center rounded-sm px-5 py-2",
                    item.current
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-6 w-6",
                      item.current
                        ? "text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                </button>
                <p className="text-xs">{item.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "group inline-flex flex-col items-center justify-center px-5 py-2",
                    item.current ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-6 w-6",
                      item.current ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
                <p className="text-xs">{item.name}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
