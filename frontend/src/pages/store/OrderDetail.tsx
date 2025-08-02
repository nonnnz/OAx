"use client"

import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"

// Mock data
const orderDetails = {
  id: "order-1",
  customerName: "John Doe",
  customerAddress: "123 Main St, City, Country",
  status: "WAITING_DELIVERY",
  products: [
    { id: "product-1", name: "Espresso", quantity: 2, price: 60 },
    { id: "product-2", name: "Cappuccino", quantity: 1, price: 75 },
  ],
  totalAmount: 3,
  totalPrice: 195,
  createdAt: "2023-06-15T10:30:00Z",
  paymentMethod: "Bank Transfer",
  paymentStatus: "Paid",
  slipUrl: "/placeholder.jpg",
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [action, setAction] = useState<"deliver" | "complete" | "cancel">(
    "deliver",
  )

  const handleBack = () => {
    navigate(-1)
  }

  const handleAction = (action: "deliver" | "complete" | "cancel") => {
    setAction(action)
    setConfirmDialogOpen(true)
  }

  const handleConfirmAction = () => {
    // In a real app, this would send data to an API
    if (action === "deliver") {
      toast.success("Order marked as in delivery")
    } else if (action === "complete") {
      toast.success("Order marked as completed")
    } else {
      toast.success("Order cancelled")
    }
    setConfirmDialogOpen(false)
    // Navigate back after action
    setTimeout(() => navigate(-1), 1000)
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="ml-2 text-2xl font-semibold">Order Details</h1>
      </div>

      <Card className="mb-4 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Order #{orderId}</h2>
            <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
              {orderDetails.status === "WAITING_PAYMENT" && "Waiting Payment"}
              {orderDetails.status === "WAITING_DELIVERY" && "Waiting Delivery"}
              {orderDetails.status === "IN_DELIVERY" && "In Delivery"}
              {orderDetails.status === "COMPLETED" && "Completed"}
              {orderDetails.status === "CANCELLED" && "Cancelled"}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Customer:</span>{" "}
              {orderDetails.customerName}
            </div>
            <div className="text-sm">
              <span className="font-medium">Address:</span>{" "}
              {orderDetails.customerAddress}
            </div>
            <div className="text-sm">
              <span className="font-medium">Date:</span>{" "}
              {new Date(orderDetails.createdAt).toLocaleString()}
            </div>
            <div className="text-sm">
              <span className="font-medium">Payment:</span>{" "}
              {orderDetails.paymentMethod} ({orderDetails.paymentStatus})
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Order Items</h3>
            <div className="rounded-md border">
              {orderDetails.products.map((product, index) => (
                <div
                  key={product.id}
                  className={`flex justify-between p-3 ${index < orderDetails.products.length - 1 ? "border-b" : ""}`}
                >
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-muted-foreground ml-2 text-sm">
                      x{product.quantity}
                    </span>
                  </div>
                  <span>฿{product.price * product.quantity}</span>
                </div>
              ))}
              <div className="bg-muted/50 flex justify-between border-t p-3">
                <span className="font-medium">Total</span>
                <span className="font-medium">฿{orderDetails.totalPrice}</span>
              </div>
            </div>
          </div>

          {orderDetails.slipUrl && (
            <div className="space-y-2">
              <h3 className="font-medium">Payment Slip</h3>
              <div className="overflow-hidden rounded-md border">
                <img
                  src={orderDetails.slipUrl || "/placeholder.svg"}
                  alt="Payment slip"
                  className="h-auto w-full"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {orderDetails.status === "WAITING_DELIVERY" && (
              <>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleAction("cancel")}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel Order
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleAction("deliver")}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Start Delivery
                </Button>
              </>
            )}
            {orderDetails.status === "IN_DELIVERY" && (
              <Button
                className="w-full"
                onClick={() => handleAction("complete")}
              >
                <Check className="mr-2 h-4 w-4" />
                Complete Order
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "deliver" && "Start Delivery"}
              {action === "complete" && "Complete Order"}
              {action === "cancel" && "Cancel Order"}
            </DialogTitle>
            <DialogDescription>
              {action === "deliver" &&
                "Are you sure you want to mark this order as in delivery?"}
              {action === "complete" &&
                "Are you sure you want to mark this order as completed?"}
              {action === "cancel" &&
                "Are you sure you want to cancel this order?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              No, Cancel
            </Button>
            <Button
              variant={action === "cancel" ? "destructive" : "default"}
              onClick={handleConfirmAction}
            >
              Yes, Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
