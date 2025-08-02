import { Link } from "react-router-dom"
import { Loader2, Plus, Store as StoreIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

import { Logo } from "@/components/logo"
import { getStore } from "@/api/store"
import { Store } from "@/types"
import { useState, useEffect } from "react"
import { useLiffStore } from "@/stores/liffStore"
import { toast } from "sonner"

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [timelimit] = useState(2000) // 2 seconds
  const [error, setError] = useState(false)

  const liffStore = useLiffStore()
  useEffect(() => {
    const fetchStores = async () => {
      const timeout = setTimeout(() => {
        setLoading(true)
      }, timelimit)
      try {
        const response = await getStore()
        setStores(response.data.stores)
        setLoading(false)
      } catch (error) {
        console.error(error)
        toast.error("Error fetching stores")
        setError(true)
        setLoading(false)
      }
      clearTimeout(timeout)
    }
    fetchStores()
    console.log("current backend url", import.meta.env.VITE_API_URL)
  }, [timelimit])

  console.log(stores)
  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-8 flex justify-center">
        <Logo size={32} />
      </div>
      {/* <button onClick={() => liffStore.logout()}>Logout</button> */}

      <div className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          👋 Hello {liffStore.profile?.displayName}
        </p>
        {/* Store Cards */}
        {error && (
          <p className="text-center text-red-500">Error fetching stores</p>
        )}
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          stores.map((store) => (
            <Link to={`/store/${store.id}`} key={store.id}>
              <Card className="mb-4 p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="bg-muted flex h-12 w-12 items-center justify-center overflow-hidden rounded-md">
                    <StoreIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">{store.storeName}</h1>
                    <div className="mt-1 flex items-center gap-2"></div>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}

        {/* Add Store Card */}
        <Link to="/register">
          <Card className="h-20 justify-center border-dashed p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Plus className="text-primary h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold">Add Store</h1>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
