"use client"

import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import {
  ShoppingBag,
  CreditCard,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Pencil,
  MoreVertical,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import { MenuSelector } from "../../components/MenuSelector"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import {
  getStoreOrders,
  updateStoreOrder,
  getStoreTransactions,
  updateTransactionByOrderID,
} from "@/api/store"
import { Order, Transaction, Slip } from "@/types"

const orderUpdateSchema = z.object({
  status: z.string(),
  customerName: z.string().min(1, "Customer name is required"),
  customerAdds: z.string().min(1, "Customer address is required"),
})

const menuOptions = [
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "transfers", label: "Transfers", icon: CreditCard },
]

export default function OrderManagement() {
  const { storeId } = useParams<{ storeId: string }>()
  const [activeMenu, setActiveMenu] = useState("orders")
  const [orderTab, setOrderTab] = useState("waiting-payment")
  const [transferTab, setTransferTab] = useState("not-verified")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<Transaction | null>(
    null,
  )
  const [action, setAction] = useState<"accept" | "reject">("accept")
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [showCustomerEdit, setShowCustomerEdit] = useState(false)
  const [statusCount, setStatusCount] = useState({
    waitingPayment: 0,
    waitingDelivery: 0,
    inDelivery: 0,
    all: 0,
  })

  // Create maps for quick access
  // const orderMap = new Map(orders.map((order) => [order.id, order]))
  const transactionMap = new Map(
    transactions
      .filter((transaction) => transaction && transaction.orderId) // Filter out null/undefined transactions
      .map((transaction) => [transaction.orderId, transaction]),
  )

  const orderUpdateForm = useForm<z.infer<typeof orderUpdateSchema>>({
    resolver: zodResolver(orderUpdateSchema),
    defaultValues: {
      status: "",
      customerName: "",
      customerAdds: "",
    },
  })

  // Fetch orders and transactions
  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return
      try {
        const [ordersResponse, transactionsResponse] = await Promise.all([
          getStoreOrders(storeId),
          getStoreTransactions(storeId),
        ])
        if (ordersResponse.success) {
          setOrders(ordersResponse.data.orders || [])
          setStatusCount({
            waitingPayment: ordersResponse.data.orders.filter(
              (order) => order.status === "PENDING",
            ).length,
            waitingDelivery: ordersResponse.data.orders.filter(
              (order) => order.status === "WAITING_DELIVERY",
            ).length,
            inDelivery: ordersResponse.data.orders.filter(
              (order) => order.status === "IN_DELIVERY",
            ).length,
            all: ordersResponse.data.orders.length,
          })
        }
        if (transactionsResponse.success) {
          setTransactions(transactionsResponse.data.transactions || [])
          console.log(transactionsResponse.data.transactions)
        }
      } catch {
        toast.error("Error fetching data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [storeId])

  const handleConfirmTransfer = (
    transfer: Transaction,
    action: "accept" | "reject",
  ) => {
    setSelectedTransfer(transfer)
    setAction(action)
    setConfirmDialogOpen(true)
  }

  const handleConfirmAction = async () => {
    if (!storeId || !selectedTransfer) return
    try {
      console.log(selectedTransfer)
      // return
      const response = await updateTransactionByOrderID(
        storeId,
        selectedTransfer.orderId,
        action === "accept" ? "confirmed" : "rejected",
      )
      if (response.success) {
        toast.success(
          action === "accept"
            ? "Payment verified successfully"
            : "Payment rejected",
        )
        // Refresh data
        const [ordersResponse, transactionsResponse] = await Promise.all([
          getStoreOrders(storeId),
          getStoreTransactions(storeId),
        ])
        if (ordersResponse.success) {
          setOrders(ordersResponse.data.orders || [])
        }
        if (transactionsResponse.success) {
          setTransactions(transactionsResponse.data.transactions || [])
        }
      } else {
        toast.error("Error updating order status")
      }
      setConfirmDialogOpen(false)
      setSelectedTransfer(null)
    } catch {
      toast.error("Error updating order status")
    }
  }

  const getFilteredOrders = (status: string) => {
    if (status === "all") return orders
    return orders.filter((order) => {
      if (status === "waiting-payment") return order.status === "PENDING"
      if (status === "waiting-delivery")
        return order.status === "WAITING_DELIVERY"
      if (status === "in-delivery") return order.status === "IN_DELIVERY"
      return false
    })
  }

  const getFilteredTransfers = (status: string) => {
    if (status === "all")
      return transactions.filter((transfer) => transfer !== null)

    return transactions.filter((transfer) => {
      if (!transfer) return false
      if (status === "not-verified")
        return (
          !transfer.isConfirmed &&
          transfer.paymentMethod !== null &&
          transfer.paymentMethod !== "REJECTED"
        )
      return false
    })
  }

  const handleUpdateOrder = async () => {
    if (!storeId || !editingOrder) return
    try {
      const response = await updateStoreOrder(storeId, editingOrder.id, {
        status: orderUpdateForm.getValues("status"),
        customerName: orderUpdateForm.getValues("customerName"),
        customerAdds: orderUpdateForm.getValues("customerAdds"),
      })
      if (response.success) {
        toast.success("Order updated successfully")
        // Refresh data
        const ordersResponse = await getStoreOrders(storeId)
        if (ordersResponse.success) {
          setOrders(ordersResponse.data.orders || [])
        }
        setStatusCount({
          waitingPayment: ordersResponse.data.orders.filter(
            (order) => order.status === "PENDING",
          ).length,
          waitingDelivery: ordersResponse.data.orders.filter(
            (order) => order.status === "WAITING_DELIVERY",
          ).length,
          inDelivery: ordersResponse.data.orders.filter(
            (order) => order.status === "IN_DELIVERY",
          ).length,
          all: ordersResponse.data.orders.length,
        })
        setIsEditingOrder(false)
        setEditingOrder(null)
        orderUpdateForm.reset()
      } else {
        toast.error("Error updating order")
      }
    } catch {
      toast.error("Error updating order")
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Order Management</h1>

      {/* Menu Selector */}
      <MenuSelector
        options={menuOptions}
        value={activeMenu}
        onChange={setActiveMenu}
        className="mb-6"
      />

      {/* Orders Management */}
      {activeMenu === "orders" && (
        <Tabs value={orderTab} onValueChange={setOrderTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="waiting-payment" className="relative">
              รอชำระเงิน
              {statusCount.waitingPayment > 0 ? (
                <Badge className="absolute -top-2 left-full min-w-5 -translate-x-2/2 px-1">
                  {statusCount.waitingPayment > 99
                    ? "99+"
                    : statusCount.waitingPayment}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="waiting-delivery" className="relative">
              รอจัดส่ง
              {statusCount.waitingDelivery > 0 ? (
                <Badge className="absolute -top-2 left-full min-w-5 -translate-x-2/2 px-1">
                  {statusCount.waitingDelivery > 99
                    ? "99+"
                    : statusCount.waitingDelivery}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="in-delivery" className="relative">
              กำลังจัดส่ง
              {statusCount.inDelivery > 0 ? (
                <Badge className="absolute -top-2 left-full min-w-5 -translate-x-2/2 px-1">
                  {statusCount.inDelivery > 99 ? "99+" : statusCount.inDelivery}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="all" className="overflow-hidden">
              ทั้งหมด
            </TabsTrigger>
          </TabsList>

          <TabsContent value={orderTab} className="mt-4 space-y-4">
            {getFilteredOrders(orderTab).length > 0 ? (
              getFilteredOrders(orderTab).map((order) =>
                isEditingOrder && editingOrder?.id === order.id ? (
                  <Card key={order.id} className="p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsEditingOrder(false)
                          setEditingOrder(null)
                          orderUpdateForm.reset()
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h3 className="text-lg font-medium">Update Order</h3>
                    </div>

                    {/* Order Details Section */}
                    <div className="mb-6 space-y-4 rounded-lg border p-4">
                      <div className="space-y-4">
                        {/* Customer Details */}
                        <div className="space-y-2">
                          <h4 className="font-medium">Customer Details</h4>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">
                                Name:
                              </span>{" "}
                              {order.customerName}
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                Address:
                              </span>{" "}
                              {order.customerAdds}
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                Line ID:
                              </span>{" "}
                              {order.customerLineId}
                            </p>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <h4 className="font-medium">Order Items</h4>
                          <div className="space-y-1">
                            {order.productInfo.map((product) => (
                              <div
                                key={product.productId}
                                className="flex justify-between text-sm"
                              >
                                <span>
                                  {product.name} x{product.quantity}
                                </span>
                                <span>฿{product.price * product.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between border-t pt-2 text-sm">
                            <span>Total: {order.productInfo.length} items</span>
                            <span className="font-medium">
                              ฿
                              {order.productInfo.reduce(
                                (sum, product) =>
                                  sum + product.price * product.quantity,
                                0,
                              )}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Order ID: {order.id}
                          </div>
                        </div>

                        {/* Transaction Details */}
                        {transactionMap.has(order.id) && (
                          <div className="space-y-2">
                            <h4 className="font-medium">Payment Details</h4>
                            <div className="space-y-1">
                              {/* Transaction Attributes */}
                              <div className="rounded-md border p-3">
                                <div className="space-y-1 text-sm">
                                  <p>
                                    <span className="text-muted-foreground">
                                      Transaction ID:
                                    </span>{" "}
                                    {transactionMap.get(order.id)?.id}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">
                                      Total Amount:
                                    </span>{" "}
                                    ฿{transactionMap.get(order.id)?.totalAmount}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">
                                      Payment Method:
                                    </span>{" "}
                                    {transactionMap.get(order.id)
                                      ?.paymentMethod || "Not specified"}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">
                                      Status:
                                    </span>{" "}
                                    {transactionMap.get(order.id)
                                      ?.paymentMethod === "REJECTED" ? (
                                      <Badge variant="destructive">
                                        Rejected
                                      </Badge>
                                    ) : transactionMap.get(order.id)
                                        ?.isConfirmed ? (
                                      <Badge variant="default">Confirmed</Badge>
                                    ) : (
                                      <Badge variant="default">Pending</Badge>
                                    )}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">
                                      Created:
                                    </span>{" "}
                                    {new Date(
                                      transactionMap.get(order.id)?.createdAt ||
                                        "",
                                    ).toLocaleString()}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">
                                      Updated:
                                    </span>{" "}
                                    {new Date(
                                      transactionMap.get(order.id)?.updatedAt ||
                                        "",
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {/* Slip Details */}
                              {transactionMap
                                .get(order.id)
                                ?.slip.map((s: Slip, index: number) => (
                                  <div
                                    key={s.id}
                                    className="mt-4 rounded-md border p-3"
                                  >
                                    <h5 className="mb-2 font-medium">
                                      Slip #{index + 1}
                                    </h5>
                                    <div className="space-y-1 text-sm">
                                      <p>
                                        <span className="text-muted-foreground">
                                          Transaction Date:
                                        </span>{" "}
                                        {s.transDate}
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Transaction Time:
                                        </span>{" "}
                                        {s.transTime}
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Sender:
                                        </span>{" "}
                                        {s.sender.displayName} ({s.sendingBank})
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Sender Account:
                                        </span>{" "}
                                        {s.sender.account.value}
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Receiver:
                                        </span>{" "}
                                        {s.receiver.displayName} (
                                        {s.receivingBank})
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Receiver Account:
                                        </span>{" "}
                                        {s.receiver.account.value}
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Amount:
                                        </span>{" "}
                                        ฿{s.amount}
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">
                                          Status:
                                        </span>{" "}
                                        {s.isConfirmed ? (
                                          <Badge variant="default">
                                            Confirmed
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive">
                                            Pending
                                          </Badge>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Form {...orderUpdateForm}>
                      <form
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleUpdateOrder()
                        }}
                      >
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setShowCustomerEdit(!showCustomerEdit)
                            }
                          >
                            {showCustomerEdit
                              ? "Hide Customer Details"
                              : "Edit Customer Details"}
                          </Button>
                        </div>

                        {showCustomerEdit && (
                          <>
                            <FormField
                              control={orderUpdateForm.control}
                              name="customerName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Customer Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter customer name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={orderUpdateForm.control}
                              name="customerAdds"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Customer Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter customer address"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}

                        <FormField
                          control={orderUpdateForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <select
                                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="PENDING">รอชำระเงิน</option>
                                  <option value="WAITING_DELIVERY">
                                    รอจัดส่ง
                                  </option>
                                  <option value="IN_DELIVERY">
                                    กำลังจัดส่ง
                                  </option>
                                  <option value="CANCELLED">ยกเลิกแล้ว</option>
                                  <option value="FINISHED">สำเร็จ</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end">
                          <Button type="submit">Update Order</Button>
                        </div>
                      </form>
                    </Form>
                  </Card>
                ) : (
                  <Card key={order.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{order.customerName}</h3>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              order.status === "PENDING"
                                ? "destructive"
                                : order.status === "WAITING_DELIVERY"
                                  ? "default"
                                  : order.status === "IN_DELIVERY"
                                    ? "default"
                                    : order.status === "FINISHED"
                                      ? "success"
                                      : "outline"
                            }
                          >
                            {order.status === "PENDING" && "รอชำระเงิน"}
                            {order.status === "WAITING_DELIVERY" && "รอจัดส่ง"}
                            {order.status === "IN_DELIVERY" && "กำลังจัดส่ง"}
                            {order.status === "CANCELLED" && "ยกเลิกแล้ว"}
                            {order.status === "FINISHED" && "สำเร็จ"}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setIsEditingOrder(true)
                                  setEditingOrder(order)
                                  orderUpdateForm.reset({
                                    customerName: order.customerName,
                                    customerAdds: order.customerAdds,
                                    status: order.status,
                                  })
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Update
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {order.productInfo.slice(0, 1).map((product) => (
                          <div
                            key={product.productId}
                            className="flex justify-between text-sm"
                          >
                            <span>
                              {product.name} x{product.quantity}
                            </span>
                            <span>฿{product.price * product.quantity}</span>
                          </div>
                        ))}
                        {order.productInfo.length > 1 && (
                          <div className="text-muted-foreground text-sm">
                            + {order.productInfo.length - 1} more items
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between border-t pt-2 text-sm">
                        <span>Total: {order.productInfo.length} items</span>
                        <span className="font-medium">
                          ฿
                          {order.productInfo.reduce(
                            (sum, product) =>
                              sum + product.price * product.quantity,
                            0,
                          )}
                        </span>
                      </div>

                      <div className="text-muted-foreground border-t pt-2 text-xs">
                        Order ID: {order.id}
                      </div>
                    </div>
                  </Card>
                ),
              )
            ) : (
              <div className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No orders found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Transfers Management */}
      {activeMenu === "transfers" && (
        <Tabs value={transferTab} onValueChange={setTransferTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="not-verified">Not Verified</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={transferTab} className="mt-4 space-y-4">
            {getFilteredTransfers(transferTab).length > 0 ? (
              getFilteredTransfers(transferTab)
                .reverse()
                .map((transfer) => (
                  <Card key={transfer?.id || "unknown"} className="p-4">
                    <div className="space-y-4">
                      {/* Transaction Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">
                            Transaction ID: {transfer?.id}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Order ID: {transfer?.orderId}
                          </p>
                        </div>
                        <Badge
                          variant={
                            transfer?.isConfirmed
                              ? "default"
                              : transfer?.paymentMethod === "REJECTED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {transfer?.isConfirmed
                            ? "Verified"
                            : transfer?.paymentMethod === "REJECTED"
                              ? "Rejected"
                              : "Pending"}
                        </Badge>
                      </div>

                      {/* Transaction Details */}
                      <div className="rounded-md border p-3">
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">
                              Total Amount:
                            </span>{" "}
                            ฿{transfer?.totalAmount}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Payment Method:
                            </span>{" "}
                            {transfer?.paymentMethod || "Not specified"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Created:
                            </span>{" "}
                            {new Date(
                              transfer?.createdAt || "",
                            ).toLocaleString()}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Updated:
                            </span>{" "}
                            {new Date(
                              transfer?.updatedAt || "",
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Slip Details */}
                      {transfer?.slip && transfer.slip.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium">Payment Slips</h4>
                          {transfer.slip.map((s: Slip, index: number) => (
                            <div key={s.id} className="rounded-md border p-3">
                              <h5 className="mb-2 font-medium">
                                Slip #{index + 1}
                              </h5>
                              <div className="space-y-1 text-sm">
                                <p>
                                  <span className="text-muted-foreground">
                                    Transaction Date:
                                  </span>{" "}
                                  {s.transDate}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Transaction Time:
                                  </span>{" "}
                                  {s.transTime}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Sender:
                                  </span>{" "}
                                  {s.sender.displayName} ({s.sendingBank})
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Sender Account:
                                  </span>{" "}
                                  {s.sender.account.value}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Receiver:
                                  </span>{" "}
                                  {s.receiver.displayName} ({s.receivingBank})
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Receiver Account:
                                  </span>{" "}
                                  {s.receiver.account.value}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Amount:
                                  </span>{" "}
                                  ฿{s.amount}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Status:
                                  </span>{" "}
                                  {s.isConfirmed ? (
                                    <Badge variant="default">Confirmed</Badge>
                                  ) : (
                                    <Badge variant="destructive">Pending</Badge>
                                  )}
                                </p>
                              </div>
                              {!s.isConfirmed && (
                                <div className="mt-3 flex justify-end gap-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      handleConfirmTransfer(transfer, "reject")
                                    }
                                  >
                                    <X className="mr-1 h-4 w-4" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleConfirmTransfer(transfer, "accept")
                                    }
                                  >
                                    <Check className="mr-1 h-4 w-4" />
                                    Accept
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons for the entire transaction */}
                      {!transfer?.isConfirmed && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleConfirmTransfer(transfer, "reject")
                            }
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject Transaction
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleConfirmTransfer(transfer, "accept")
                            }
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Accept Transaction
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
            ) : (
              <div className="flex h-40 items-center justify-center">
                <p className="text-muted-foreground">No transfers found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "accept" ? "Verify Payment" : "Reject Payment"}
            </DialogTitle>
            <DialogDescription>
              {action === "accept"
                ? "Are you sure you want to verify this payment?"
                : "Are you sure you want to reject this payment?"}
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <div className="flex items-center gap-4">
              <div className="h-16 w-16">
                {selectedTransfer.slip.length > 0 ? (
                  <img
                    src={``}
                    alt="Payment slip"
                    className="h-full w-full rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-full w-full items-center justify-center rounded">
                    <p className="text-muted-foreground text-xs">No slip</p>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">
                  {/* {selectedTransfer.slip?.senderName || "Unknown"} */}
                </p>
                <p className="text-sm">฿{selectedTransfer.totalAmount}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={action === "accept" ? "default" : "destructive"}
              onClick={handleConfirmAction}
            >
              {action === "accept" ? "Verify" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
