import { useEffect, useState } from "react"
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "@/components/ThemeProvider"
import Layout from "./layouts"
import { useLiffStore } from "./stores/liffStore"
import StoreLayout from "@/components/StoreLayout"
import HomePage from "@/pages/home"
import RegisterStorePage from "@/pages/register"
import StoreManagement from "@/pages/store/StoreManagement"
import ProductManagement from "@/pages/store/ProductManagement"
import OrderManagement from "@/pages/store/OrderManagement"
import OrderDetail from "@/pages/store/OrderDetail"
import IngredientOCR from "@/pages/store/IngredientOCR"
import ViewReport from "@/pages/store/ViewReport"

function App() {
  const initializeLiff = useLiffStore((state) => state.initializeLiff)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initialize = async () => {
      await initializeLiff()
      setLoading(false) // Set loading to false after initialization
    }
    initialize()
  }, [initializeLiff])

  if (loading) {
    return (
      <div role="status" className="flex h-screen items-center justify-center">
        <svg
          aria-hidden="true"
          className="inline h-8 w-8 animate-spin fill-green-500 text-gray-200 dark:text-gray-600"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
        <span className="sr-only">Loading...</span>
      </div> // Show loading screen until LIFF initializes
    )
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Layout>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* <Route path="/track/:orderId" element={<TrackPage />} /> */}
            <Route path="/register" element={<RegisterStorePage />} />
            <Route path="/store/:storeId" element={<StoreLayout />}>
              <Route index element={<StoreManagement />} />
              <Route path="products" element={<ProductManagement />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="orders/:orderId" element={<OrderDetail />} />
              <Route path="ocr" element={<IngredientOCR />} />
              <Route path="reports" element={<ViewReport />} />
            </Route>
          </Routes>
        </Router>
      </Layout>
    </ThemeProvider>
  )
}

export default App
