/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Store,
  CreditCard,
  Bot,
  Pencil,
  Trash,
  Plus,
  Save,
  Loader2,
  Landmark,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

import bankLists from "thai-banks-logo"

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Bank } from "thai-banks-logo/types"

import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Textarea } from "../../components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group"
import { Switch } from "../../components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "../../components/ui/select"
import { MenuSelector } from "../../components/MenuSelector"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form"

import {
  getStoreByID,
  updateStore,
  deleteStore,
  updateStoreAccounts,
  deleteStoreAccount,
  updateStoreLineOABot,
} from "@/api/store"
import {
  Store as StoreType,
  Account,
  OpeningStatus,
  DayOfWeek,
  // OpeningHour,
} from "@/types"

const menuOptions = [
  { id: "profile", label: "ร้านค้า", icon: Store },
  { id: "accounts", label: "บัญชี", icon: CreditCard },
  { id: "lineoa", label: "LINE OA", icon: Bot },
]

// Zod schemas
const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/

// const DayOfWeekEnum = z.nativeEnum(DayOfWeek)

// const OpeningStatusEnum = z.nativeEnum(OpeningStatus)

// const openingHourSchema = z.object({
//   dayOfWeek: DayOfWeekEnum,
//   openingTime: z.string().optional(),
//   closingTime: z.string().optional(),
//   closed: z.boolean(),
// })

const storeFormSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  phone: z.string().regex(phoneRegex, "Invalid phone number"),
  address: z.string().optional(),
  isCash: z.boolean(),
  openingStatus: z.nativeEnum(OpeningStatus),
})

const bankAccountSchema = z.object({
  receiverType: z.literal("BANK"),
  receiverBank: z.string().min(1, "Bank name is required"),
  receiverAccount: z.string().min(1, "Account number is required"),
  accountNameTh: z.string().min(1, "Thai account name is required"),
  accountNameEn: z.string().min(1, "English account name is required"),
  promptpayId: z.null(),
})

const promptpayAccountSchema = z.object({
  receiverType: z.literal("PROMPTPAY"),
  promptpayId: z.string().min(1, "PromptPay ID is required"),
  accountNameTh: z.string().min(1, "Thai account name is required"),
  accountNameEn: z.string().min(1, "English account name is required"),
  receiverBank: z.null(),
  receiverAccount: z.null(),
})

const lineOABotSchema = z.object({
  channelSecret: z.string().min(1, "Channel secret is required"),
  channelAccessToken: z.string().min(1, "Channel access token is required"),
})

const accountTypes = [
  {
    id: "BANK",
    label: "ธนาคาร",
    icon: Landmark,
  },
  { id: "PROMPTPAY", label: "พร้อมเพย์", icon: null },
]

const daysOfWeek = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
]

const timeOptions = [
  { value: "00:00", label: "12:00 AM" },
  { value: "00:30", label: "12:30 AM" },
  { value: "01:00", label: "1:00 AM" },
  { value: "01:30", label: "1:30 AM" },
  { value: "02:00", label: "2:00 AM" },
  { value: "02:30", label: "2:30 AM" },
  { value: "03:00", label: "3:00 AM" },
  { value: "03:30", label: "3:30 AM" },
  { value: "04:00", label: "4:00 AM" },
  { value: "04:30", label: "4:30 AM" },
  { value: "05:00", label: "5:00 AM" },
  { value: "05:30", label: "5:30 AM" },
  { value: "06:00", label: "6:00 AM" },
  { value: "06:30", label: "6:30 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "07:30", label: "7:30 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "08:30", label: "8:30 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "09:30", label: "9:30 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "13:30", label: "1:30 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "14:30", label: "2:30 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "15:30", label: "3:30 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "16:30", label: "4:30 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "17:30", label: "5:30 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "18:30", label: "6:30 PM" },
  { value: "19:00", label: "7:00 PM" },
  { value: "19:30", label: "7:30 PM" },
  { value: "20:00", label: "8:00 PM" },
  { value: "20:30", label: "8:30 PM" },
  { value: "21:00", label: "9:00 PM" },
  { value: "21:30", label: "9:30 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "22:30", label: "10:30 PM" },
  { value: "23:00", label: "11:00 PM" },
  { value: "23:30", label: "11:30 PM" },
]

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const banks: Bank[] = Object.values(bankLists).filter(
  (bank) => !["PromptPay", "TrueMoney"].includes((bank as any).symbol),
)

export default function StoreManagement() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const [activeMenu, setActiveMenu] = useState("profile")
  const [editMode, setEditMode] = useState(false)
  const [store, setStore] = useState<StoreType | null>(null)
  // const [storeOpeningHours, setStoreOpeningHours] = useState(
  //   daysOfWeek.map((day) => ({
  //     dayOfWeek: day.value,
  //     closed: day.value === "SUNDAY" || day.value === "SATURDAY",
  //     hasTime: false,
  //     openingTime: "",
  //     closingTime: "",
  //   })),
  // )
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAccountType, setSelectedAccountType] = useState<
    "BANK" | "PROMPTPAY"
  >("BANK")
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccountIndex, setEditingAccountIndex] = useState<number | null>(
    null,
  )

  const [openingHours, setOpeningHours] = useState(
    daysOfWeek.map((day) => ({
      dayOfWeek: day.value,
      closed: day.value === "SUNDAY" || day.value === "SATURDAY",
      hasTime: false,
      openingTime: "",
      closingTime: "",
    })),
  )
  // Forms
  const storeForm = useForm<z.infer<typeof storeFormSchema>>({
    resolver: zodResolver(storeFormSchema),
  })

  const bankAccountForm = useForm<z.infer<typeof bankAccountSchema>>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      receiverType: "BANK",
      receiverBank: "",
      receiverAccount: "",
      accountNameTh: "",
      accountNameEn: "",
      promptpayId: null,
    },
  })

  const promptpayAccountForm = useForm<z.infer<typeof promptpayAccountSchema>>({
    resolver: zodResolver(promptpayAccountSchema),
    defaultValues: {
      receiverType: "PROMPTPAY",
      promptpayId: "",
      accountNameTh: "",
      accountNameEn: "",
      receiverBank: null,
      receiverAccount: null,
    },
  })

  const lineOAForm = useForm<z.infer<typeof lineOABotSchema>>({
    resolver: zodResolver(lineOABotSchema),
  })

  // Fetch store data
  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return
      try {
        const response = await getStoreByID(storeId)
        if (response.success) {
          setStore(response.data)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          storeForm.reset(response.data as any)
          const setOpeningHoursTemp = response.data.openingHours.map(
            (hour) => ({
              dayOfWeek: hour.dayOfWeek,
              closed: hour.closed,
              hasTime:
                !hour.closed &&
                hour.openingTime !== "" &&
                hour.closingTime !== "",
              openingTime: hour.openingTime,
              closingTime: hour.closingTime,
            }),
          )
          setOpeningHours(setOpeningHoursTemp)
          lineOAForm.reset(response.data.lineOABot)
        }
      } catch {
        toast.error("Error fetching store data")
      } finally {
        setLoading(false)
      }
    }
    fetchStore()
  }, [storeId])

  const handleSaveProfile = async () => {
    if (!storeId) return
    try {
      const values = storeForm.getValues()
      // Create the final store object
      const storeObject = {
        storeName: values.storeName,
        phone: values.phone,
        address: values.address || "",
        isCash: values.isCash,
        openingStatus: values.openingStatus,
        openingHours:
          values.openingStatus === "OPEN_WITH_TIME"
            ? openingHours.map((hour) => ({
                dayOfWeek: hour.dayOfWeek as DayOfWeek,
                openingTime: hour.openingTime,
                closingTime: hour.closingTime,
                closed: hour.closed,
              }))
            : [],
      }
      console.log(storeObject)
      // return
      const response = await updateStore(storeId, storeObject)
      if (response.success) {
        setStore(response.data)
        const setOpeningHoursTemp = response.data.openingHours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          closed: hour.closed,
          hasTime:
            !hour.closed && hour.openingTime !== "" && hour.closingTime !== "",
          openingTime: hour.openingTime,
          closingTime: hour.closingTime,
        }))
        setOpeningHours(setOpeningHoursTemp)
        toast.success("Store profile updated successfully")
        setEditMode(false)
      } else {
        toast.error("Error updating store profile")
      }
    } catch {
      toast.error("Error updating store profile")
    }
  }

  // const handleDayClosed = (dayIndex: number, closed: boolean) => {
  //   const updatedHours = [...openingHours]
  //   updatedHours[dayIndex].closed = closed
  //   setOpeningHours(updatedHours)
  // }

  const handleTimeChange = (
    dayIndex: number,
    type: "openingTime" | "closingTime",
    value: string,
  ) => {
    const updatedHours = [...openingHours]
    if (type === "openingTime") {
      if (
        updatedHours[dayIndex].closingTime &&
        value >= updatedHours[dayIndex].closingTime
      )
        return toast.error("Opening time must be before closing time")
    } else {
      if (
        updatedHours[dayIndex].openingTime &&
        value <= updatedHours[dayIndex].openingTime
      )
        return toast.error("Closing time must be after opening time")
    }
    updatedHours[dayIndex][type] = value
    setOpeningHours(updatedHours)
  }

  const toggleDayEnabled = (dayIndex: number) => {
    // console.log(dayIndex)
    const updatedHours = [...openingHours]
    updatedHours[dayIndex].closed = !updatedHours[dayIndex].closed
    // console.log(updatedHours)
    // Reset time settings when disabling the day
    if (updatedHours[dayIndex].closed) {
      updatedHours[dayIndex].hasTime = false
      updatedHours[dayIndex].openingTime = ""
      updatedHours[dayIndex].closingTime = ""
    }

    setOpeningHours(updatedHours)
  }

  const toggleTimeSelection = (dayIndex: number) => {
    console.log(dayIndex)
    const updatedHours = [...openingHours]
    updatedHours[dayIndex].hasTime = !updatedHours[dayIndex].hasTime

    // Set default time if enabling time selection
    if (updatedHours[dayIndex].hasTime) {
      updatedHours[dayIndex].openingTime = "09:00"
      updatedHours[dayIndex].closingTime = "18:00"
    } else {
      updatedHours[dayIndex].openingTime = ""
      updatedHours[dayIndex].closingTime = ""
    }

    setOpeningHours(updatedHours)
  }

  const handleDeleteStore = async () => {
    if (!storeId) return
    try {
      const response = await deleteStore(storeId)
      if (response.success) {
        toast.success("Store deleted successfully")
        navigate("/")
      } else {
        toast.error("Error deleting store")
      }
    } catch {
      toast.error("Error deleting store")
    }
    setDeleteDialogOpen(false)
  }

  const handleAddAccount = async () => {
    if (!storeId || !store) return

    try {
      let newAccount: Account
      if (selectedAccountType === "BANK") {
        const values = bankAccountForm.getValues()
        if (
          values.receiverBank === "" ||
          values.receiverAccount === "" ||
          values.accountNameEn === "" ||
          values.accountNameTh === ""
        ) {
          return toast.error("Please fill in all fields")
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        newAccount = {
          ...values,
          receiverType: "BANK",
          promptpayId: null,
        }
      } else {
        const values = promptpayAccountForm.getValues()
        if (
          values.promptpayId === "" ||
          values.accountNameEn === "" ||
          values.accountNameTh === ""
        ) {
          return toast.error("Please fill in all fields")
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        newAccount = {
          ...values,
          receiverType: "PROMPTPAY",
          receiverBank: null,
          receiverAccount: null,
        }
      }
      let accountsToUpdate: Account[]
      if (editingAccountIndex !== null) {
        accountsToUpdate = [...store.accounts]
        accountsToUpdate[editingAccountIndex] = newAccount
      } else {
        accountsToUpdate = [...store.accounts, newAccount]
      }

      console.log(accountsToUpdate)
      console.log(editingAccountIndex ? "editing" : "adding")
      // return
      const response = await updateStoreAccounts(storeId, accountsToUpdate)
      if (response.success) {
        setStore(response.data)
        toast.success(
          editingAccountIndex !== null
            ? "Account updated successfully"
            : "Account added successfully",
        )
        setShowAccountForm(false)
        setEditingAccountIndex(null)
        bankAccountForm.reset({
          receiverType: "BANK" as const,
          receiverBank: "",
          receiverAccount: "",
          accountNameTh: "",
          accountNameEn: "",
        })
        promptpayAccountForm.reset({
          receiverType: "PROMPTPAY" as const,
          promptpayId: "",
          accountNameTh: "",
          accountNameEn: "",
        })
      } else {
        toast.error("Error updating accounts")
      }
    } catch {
      toast.error("Error updating accounts")
    }
  }

  const handleRemoveAccount = async (index: number) => {
    if (!storeId) return
    try {
      const response = await deleteStoreAccount(storeId, index)
      if (response.success) {
        setStore(response.data)
        toast.success("Account removed successfully")
      } else {
        toast.error("Error removing account")
      }
    } catch {
      toast.error("Error removing account")
    }
  }

  const handleSaveLineOA = async () => {
    if (!storeId) return
    try {
      const values = lineOAForm.getValues() as any
      const response = await updateStoreLineOABot(storeId, values)
      if (response.success) {
        setStore(response.data)
        toast.success("LINE OA settings updated successfully")
      } else {
        toast.error("Error updating LINE OA settings")
      }
    } catch {
      toast.error("Error updating LINE OA settings")
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Store not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Store Management</h1>

      {/* Menu Selector */}
      <MenuSelector
        options={menuOptions}
        value={activeMenu}
        onChange={setActiveMenu}
        className="mb-6"
      />

      {/* Store Profile */}
      {activeMenu === "profile" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ข้อมูลร้านค้า</CardTitle>
            <div className="flex gap-2">
              {!editMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  แก้ไข
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleSaveProfile}>
                  <Save className="mr-2 h-4 w-4" />
                  บันทึก
                </Button>
              )}
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash className="mr-2 h-4 w-4" />
                    ลบร้านค้า
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>ลบร้านค้า</DialogTitle>
                    <DialogDescription>
                      คุณแน่ใจหรือว่าต้องการลบร้านค้านี้?
                      การดำเนินการนี้ไม่สามารถยกเลิกได้
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      ยกเลิก
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteStore}>
                      ลบร้านค้า
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Form {...storeForm}>
                <form className="space-y-4">
                  <FormField
                    control={storeForm.control}
                    name="storeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={storeForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={storeForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={storeForm.control}
                    name="isCash"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Accept Cash Payment</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={storeForm.control}
                    name="openingStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Status</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="grid grid-cols-1 gap-2"
                          >
                            <div className="flex items-center space-x-2 rounded-md border p-3">
                              <RadioGroupItem value="OPEN" id="open" />
                              <Label
                                htmlFor="open"
                                className="flex-1 cursor-pointer"
                              >
                                Always Open
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 rounded-md border p-3">
                              <RadioGroupItem
                                value="OPEN_WITH_TIME"
                                id="open-time"
                              />
                              <Label
                                htmlFor="open-time"
                                className="flex-1 cursor-pointer"
                              >
                                Open with Schedule
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 rounded-md border p-3">
                              <RadioGroupItem value="CLOSE" id="closed" />
                              <Label
                                htmlFor="closed"
                                className="flex-1 cursor-pointer"
                              >
                                Closed
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {storeForm.watch("openingStatus") === "OPEN_WITH_TIME" && (
                    <div className="space-y-3 rounded-md border p-3">
                      <h2 className="font-medium">Opening Hours</h2>

                      {openingHours.map((day, dayIndex) => (
                        <div
                          key={day.dayOfWeek}
                          className="flex flex-col gap-2 rounded-lg border p-4"
                        >
                          {/* Enable/Disable Toggle */}
                          <div className="flex items-center justify-between">
                            <span>{day.dayOfWeek}</span>
                            <Switch
                              checked={!day.closed}
                              onCheckedChange={() => toggleDayEnabled(dayIndex)}
                            />
                          </div>

                          {/* "Add Time" Button (Only shown if day is enabled) */}
                          {!day.closed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleTimeSelection(dayIndex)}
                              type="button"
                            >
                              {day.hasTime ? "Remove Time" : "Add Time"}
                            </Button>
                          )}
                          {/* Time Selectors (Only shown if "Add Time" is clicked) */}
                          {!day.closed && day.hasTime && (
                            <div className="grid grid-cols-2 gap-4">
                              <Select
                                value={day.openingTime}
                                onValueChange={(value) =>
                                  handleTimeChange(
                                    dayIndex,
                                    "openingTime",
                                    value,
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Open" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={day.closingTime}
                                onValueChange={(value) =>
                                  handleTimeChange(
                                    dayIndex,
                                    "closingTime",
                                    value,
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Close" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr,2fr] gap-4">
                  <div className="text-2xl font-semibold">
                    {store.storeName}
                  </div>

                  <div className="font-semibold">Phone:</div>
                  <div>{store.phone}</div>

                  <div className="font-semibold">Address:</div>
                  <div>{store.address}</div>

                  <div className="font-semibold">Cash Payment:</div>
                  <div>{store.isCash ? "Accepted" : "Not Accepted"}</div>

                  <div className="font-semibold">Opening Status:</div>
                  <div>
                    {store.openingStatus === "OPEN"
                      ? "Always Open"
                      : store.openingStatus === "OPEN_WITH_TIME"
                        ? "Open with Schedule"
                        : "Closed"}
                  </div>
                </div>

                {store.openingStatus === "OPEN_WITH_TIME" && (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-semibold">Opening Hours:</h3>
                    <div className="space-y-1">
                      {store.openingHours.map((day) => (
                        <div
                          key={day.dayOfWeek}
                          className="flex justify-between text-sm"
                        >
                          <span>{day.dayOfWeek}</span>
                          <span>
                            {day.closed
                              ? "Closed"
                              : `${day.openingTime} - ${day.closingTime}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accounts Management */}
      {activeMenu === "accounts" && (
        <div className="space-y-4">
          {!showAccountForm && (
            <div className="flex justify-end">
              <Button onClick={() => setShowAccountForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          )}

          {showAccountForm ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingAccountIndex !== null
                    ? "Edit Account"
                    : "Add Account"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Account type selection */}
                  <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-2">
                    <div className="flex min-w-max space-x-2">
                      {accountTypes.map((account) => {
                        const Icon = account.icon
                        return (
                          <div
                            key={account.id}
                            className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-md border p-2 text-center ${
                              selectedAccountType === account.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-background hover:bg-accent hover:text-accent-foreground"
                            }`}
                            onClick={() => {
                              setSelectedAccountType(
                                account.id as "BANK" | "PROMPTPAY",
                              )
                              setEditingAccountIndex(null)
                              if (account.id === "BANK") {
                                bankAccountForm.reset({
                                  receiverType: "BANK",
                                  receiverBank: "",
                                  receiverAccount: "",
                                  accountNameTh: "",
                                  accountNameEn: "",
                                })
                              } else {
                                promptpayAccountForm.reset({
                                  receiverType: "PROMPTPAY",
                                  promptpayId: "",
                                  accountNameTh: "",
                                  accountNameEn: "",
                                })
                              }
                            }}
                          >
                            {Icon ? (
                              <Icon size={42} />
                            ) : account.id === "PROMPTPAY" ? (
                              <p className="mt-2 mr-2 ml-2 text-left font-bold whitespace-normal">
                                Prompt Pay
                              </p>
                            ) : (
                              <p className="text-left font-bold whitespace-normal">
                                {account.label}
                              </p>
                            )}
                            <p className="text-sm font-medium break-words whitespace-normal">
                              {account.label}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {selectedAccountType === "BANK" ? (
                    <Form
                      {...bankAccountForm}
                      key={`bank-form-${showAccountForm}`}
                    >
                      <form className="space-y-4">
                        <FormField
                          control={bankAccountForm.control}
                          name="receiverBank"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bank Name</FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a bank" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectLabel>Banks</SelectLabel>
                                      {Object.values(banks).map((bank) => (
                                        <SelectItem
                                          key={bank.symbol}
                                          value={bank.symbol}
                                        >
                                          <div className="flex items-center gap-2">
                                            <img
                                              src={bank.icon}
                                              alt={bank.name}
                                              className="h-6 w-6 rounded-full"
                                            />
                                            <span>
                                              {bank.name} ({bank.symbol})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bankAccountForm.control}
                          name="receiverAccount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Number</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter account number"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bankAccountForm.control}
                          name="accountNameTh"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name (Thai)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter account name in Thai"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bankAccountForm.control}
                          name="accountNameEn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name (English)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter account name in English"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setShowAccountForm(false)
                              setEditingAccountIndex(null)
                            }}
                          >
                            Cancel
                          </Button>

                          <Button
                            type="button"
                            className="w-full"
                            onClick={handleAddAccount}
                          >
                            {editingAccountIndex !== null ? "Update" : "Add"}{" "}
                            Account
                          </Button>
                        </div>
                      </form>
                    </Form>
                  ) : (
                    <Form
                      {...promptpayAccountForm}
                      key={`promptpay-form-${showAccountForm}`}
                    >
                      <form className="space-y-4">
                        <FormField
                          control={promptpayAccountForm.control}
                          name="promptpayId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PromptPay ID</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter phone number or ID card number"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={promptpayAccountForm.control}
                          name="accountNameTh"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name (Thai)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter account name in Thai"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={promptpayAccountForm.control}
                          name="accountNameEn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name (English)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter account name in English"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setShowAccountForm(false)
                              setEditingAccountIndex(null)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="w-full"
                            onClick={handleAddAccount}
                          >
                            {editingAccountIndex !== null ? "Update" : "Add"}{" "}
                            Account
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {store.accounts.length > 0 ? (
                store.accounts.map((account, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between gap-4 px-4">
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-xs">บัญชี</p>
                        {account.receiverType === "BANK" ? (
                          <>
                            <h2 className="text-2xl font-bold">
                              {account.receiverBank}
                            </h2>
                            <p className="text-muted-foreground text-xs">
                              {account.receiverAccount}
                            </p>
                          </>
                        ) : (
                          <>
                            <h2 className="text-2xl font-bold">พร้อมเพย์</h2>
                            <p className="text-muted-foreground text-xs">
                              {account.promptpayId}
                            </p>
                          </>
                        )}
                        <p className="text-xs">{account.accountNameTh}</p>
                        <p className="text-xs">{account.accountNameEn}</p>
                      </div>
                      <div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="default"
                            className="h-12 w-12 rounded-full"
                            onClick={() => {
                              setEditingAccountIndex(index)
                              setSelectedAccountType(
                                account.receiverType as "BANK" | "PROMPTPAY",
                              )
                              if (account.receiverType === "BANK") {
                                const bankAccount = account as {
                                  receiverType: "BANK"
                                  receiverBank: string
                                  receiverAccount: string
                                  accountNameTh: string
                                  accountNameEn: string
                                }
                                bankAccountForm.reset(bankAccount)
                              } else {
                                const promptpayAccount = account as {
                                  receiverType: "PROMPTPAY"
                                  promptpayId: string
                                  accountNameTh: string
                                  accountNameEn: string
                                }
                                promptpayAccountForm.reset(promptpayAccount)
                              }
                              setShowAccountForm(true)
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="iconXl"
                            variant="destructive"
                            className="h-12 w-12 rounded-full"
                            onClick={() => handleRemoveAccount(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="flex flex-col items-center justify-center p-6">
                  <CreditCard className="text-muted-foreground mb-4 h-12 w-12" />
                  <h3 className="mb-1 text-lg font-medium">
                    No accounts added
                  </h3>
                  <p className="text-muted-foreground mb-4 text-center text-sm">
                    Add a bank account or PromptPay to receive payments
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowAccountForm(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* LINE OA Settings */}
      {activeMenu === "lineoa" && (
        <Card>
          <CardHeader>
            <CardTitle>LINE OA Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...lineOAForm} key={`lineoa-form`}>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  console.log(e)
                  handleSaveLineOA()
                }}
              >
                <div className="">
                  <p className="text-muted-foreground text-sm">
                    ชื่อ LINE OA: {store.lineOABot.displayName}
                  </p>
                  <div className="flex flex-row items-center gap-2">
                    <p className="text-muted-foreground text-sm">
                      Basic ID: {store.lineOABot.basicId}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(store.lineOABot.basicId)
                        toast.success(
                          `Copied ${store.lineOABot.basicId} to clipboard`,
                        )
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <FormField
                  control={lineOAForm.control}
                  name="channelSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Secret</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={lineOAForm.control}
                  name="channelAccessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Access Token</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-sm">
                    Webhook URL
                  </Label>
                  <div className="mt-1 flex">
                    <Input
                      readOnly
                      value={`${import.meta.env.VITE_API_URL}/callback/${storeId}`}
                      className="rounded-r-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-l-none border-l-0"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${import.meta.env.VITE_API_URL}/callback/${storeId}`,
                        )
                        toast.success(
                          `Copied ${
                            import.meta.env.VITE_API_URL
                          }/callback/${storeId} to clipboard`,
                        )
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Use this URL in your Line OA settings
                  </p>
                </div>

                <Button className="w-full" type="submit">
                  Save Changes
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
