"use client"

import { useEffect, useState } from "react"
import { Download, Calendar, BarChart2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs"
import { getStoreStats } from "../../api/store"
import { useParams } from "react-router-dom"
import { StoreStats } from "@/types"

// Mock data
// const salesData = [
//   { date: "2023-06-01", totalSales: 1250, totalOrders: 25 },
//   { date: "2023-06-02", totalSales: 980, totalOrders: 18 },
//   { date: "2023-06-03", totalSales: 1420, totalOrders: 28 },
//   { date: "2023-06-04", totalSales: 1680, totalOrders: 32 },
//   { date: "2023-06-05", totalSales: 1100, totalOrders: 22 },
//   { date: "2023-06-06", totalSales: 950, totalOrders: 19 },
//   { date: "2023-06-07", totalSales: 1300, totalOrders: 26 },
// ]

// const topProducts = [
//   { id: "product-1", name: "Espresso", quantity: 45, revenue: 2700 },
//   { id: "product-2", name: "Cappuccino", quantity: 38, revenue: 2850 },
//   { id: "product-3", name: "Latte", quantity: 32, revenue: 2560 },
//   { id: "product-4", name: "Americano", quantity: 28, revenue: 1960 },
//   { id: "product-5", name: "Mocha", quantity: 22, revenue: 1980 },
// ]

export default function ViewReport() {
  const { storeId } = useParams()
  const [reportType, setReportType] = useState("sales")
  // const [dateRange, setDateRange] = useState("week")
  // const [startDate, setStartDate] = useState("2023-06-01")
  // const [endDate, setEndDate] = useState("2023-06-07")

  const handleExportCSV = () => {
    toast.success("Report exported as CSV")
  }

  const [totalSales, setTotalSales] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [averageOrderValue, setAverageOrderValue] = useState(0)
  const [storestats, setStoreStats] = useState<StoreStats | null>(null)

  useEffect(() => {
    const fetchStoreStats = async () => {
      try {
        const response = await getStoreStats(storeId)

        const data = await response.data
        setStoreStats(data)
        setTotalSales(data.totalSales)
        setTotalOrders(data.totalOrders)
        setAverageOrderValue(data.averageOrderValue)
      } catch (error) {
        console.error("Error fetching store stats:", error)
      }
    }
    fetchStoreStats()
  }, [storeId])

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Button onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* <Card className="mb-6">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-range">Quick Select</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card> */}

      <Tabs value={reportType} onValueChange={setReportType} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ฿{totalSales.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Average Order Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ฿{averageOrderValue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-4 w-4" />
                Daily Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {storestats?.dailySales?.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {day.totalOrders} orders
                      </div>
                    </div>
                    <div className="font-medium">
                      ฿{day.totalSales.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Tabs value={reportType} onValueChange={setReportType} className="mb-6">
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart2 className="mr-2 h-4 w-4" />
                Top Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {storestats?.productStats?.map((product, index) => (
                  <div key={product.productId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <span className="font-medium">
                        ฿{product.totalSale.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <span>{product.totalOrders} sold</span>
                      <span>
                        ฿{(product.totalSale / product.totalOrders).toFixed(2)}{" "}
                        avg
                      </span>
                    </div>
                    <div className="bg-primary/10 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full"
                        style={{
                          width: `${(product.totalSale / storestats?.totalSales) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
