/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState } from "react"
import {
  ArrowRight,
  Copy,
  CreditCard,
  Download,
  Pencil,
  Store,
  Trash,
  Bot,
  Landmark,
  Plus,
} from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectGroup,
} from "@/components/ui/select"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTrigger,
  StepperTitle,
} from "@/components/ui/stepper"
// import { Logo } from "@/components/logo"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bankLists from "thai-banks-logo"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Bank } from "thai-banks-logo/types"
import { createStore } from "@/api/store"
import { CreateStore } from "@/types"
import Topbar from "@/components/topbar"

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const banks: Bank[] = Object.values(bankLists).filter(
  (bank) => !["PromptPay", "TrueMoney"].includes((bank as any).symbol),
)

// Zod schemas based on the provided types
const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/

// const DayOfWeekEnum = z.nativeEnum(DayOfWeek)

// const OpeningStatusEnum = z.nativeEnum(OpeningStatus)

// const openingHourSchema = z.object({
//   dayOfWeek: DayOfWeekEnum,
//   openingTime: z.string().optional(),
//   closingTime: z.string().optional(),
//   closed: z.boolean(),
// })

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

const accountSchema = z.discriminatedUnion("receiverType", [
  bankAccountSchema,
  promptpayAccountSchema,
])

const lineOABotSchema = z.object({
  botId: z.string(),
  basicId: z.string(),
  displayName: z.string(),
  channelSecret: z.string().min(1, "Channel secret is required"),
  channelAccessToken: z.string().min(1, "Channel access token is required"),
})

const storeFormSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  phone: z.string().regex(phoneRegex, "Invalid phone number"),
  address: z.string().optional(),
  isCash: z.boolean(),
  openingStatus: z.string(),
})

// Mock data
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

const stepLabels = [
  { step: 1, icon: Store, label: "ร้านค้า" },
  { step: 2, icon: CreditCard, label: "บัญชี" },
  { step: 3, icon: Bot, label: "LINE OA" },
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
export default function RegisterStorePage() {
  const [step, setStep] = useState(1)
  // const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAccountType, setSelectedAccountType] = useState<
    "BANK" | "PROMPTPAY"
  >("BANK")
  const [accounts, setAccounts] = useState<z.infer<typeof accountSchema>[]>([])
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
  const [isCreateLoading, setIsCreateLoading] = useState(true)
  // Store form
  const storeForm = useForm<z.infer<typeof storeFormSchema>>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      storeName: "",
      phone: "",
      address: "",
      isCash: false,
      openingStatus: "OPEN",
    },
  })

  // Bank account form
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

  // Promptpay account form
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

  // Line OA form
  const lineOAForm = useForm<z.infer<typeof lineOABotSchema>>({
    resolver: zodResolver(lineOABotSchema),
    defaultValues: {
      botId: "",
      basicId: "",
      displayName: "",
      channelSecret: "",
      channelAccessToken: "",
    },
  })

  const [webhookUrl, setWebhookUrl] = useState("")

  const handleNext = async () => {
    if (step === 1) {
      // Validate store form before proceeding
      const valid = await storeForm.trigger()
      if (!valid) {
        toast.error("Validation Error", {
          description: "Please fix the errors in the form before proceeding.",
        })
        return
      }
    } else if (step === 2) {
      // Check if at least one account is added
      if (accounts.length === 0 && storeForm.getValues().isCash === false) {
        toast.warning("จำเป็นต้องมีบัญชี", {
          description:
            "โปรดเพิ่มบัญชีอย่างน้อย 1 บัญชี หรืออนุญาตการชําระเงินด้วยเงินสด",
        })
        return
      }
    }

    if (step < 3) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleAddAccount = () => {
    if (selectedAccountType === "BANK") {
      bankAccountForm.handleSubmit((data) => {
        if (editingAccountIndex !== null) {
          // Update existing account
          const updatedAccounts = [...accounts]
          updatedAccounts[editingAccountIndex] = {
            ...data,
            promptpayId: null,
          }
          setAccounts(updatedAccounts)
        } else {
          // Add new account
          setAccounts([...accounts, { ...data, promptpayId: null }])
        }
        // Complete reset of the form
        bankAccountForm.reset({
          receiverType: "BANK",
          receiverBank: "",
          receiverAccount: "",
          accountNameTh: "",
          accountNameEn: "",
          promptpayId: null,
        })
        setShowAccountForm(false)
        setEditingAccountIndex(null)
      })()
    } else {
      promptpayAccountForm.handleSubmit((data) => {
        if (editingAccountIndex !== null) {
          const updatedAccounts = [...accounts]
          updatedAccounts[editingAccountIndex] = {
            ...data,
            receiverBank: null,
            receiverAccount: null,
          }
          setAccounts(updatedAccounts)
        } else {
          setAccounts([
            ...accounts,
            { ...data, receiverBank: null, receiverAccount: null },
          ])
        }
        promptpayAccountForm.reset({
          receiverType: "PROMPTPAY",
          promptpayId: "",
          accountNameTh: "",
          accountNameEn: "",
          receiverBank: null,
          receiverAccount: null,
        })
        setShowAccountForm(false)
        setEditingAccountIndex(null)
      })()
    }
  }
  const handleEditAccount = (index: number) => {
    const account = accounts[index]
    setEditingAccountIndex(index)
    setSelectedAccountType(account.receiverType)

    if (account.receiverType === "BANK") {
      bankAccountForm.reset(account)
    } else {
      promptpayAccountForm.reset(account)
    }

    setShowAccountForm(true)
  }

  const handleRemoveAccount = (index: number) => {
    const updatedAccounts = [...accounts]
    updatedAccounts.splice(index, 1)
    setAccounts(updatedAccounts)
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast.success("Copied to clipboard")
  }

  const handleCreateStore = async () => {
    // Validate Line OA form
    const valid = await lineOAForm.trigger()
    if (!valid) {
      toast.error("Validation Error", {
        description:
          "Please fix the errors in the Line OA form before creating the store.",
      })
      return
    }

    // Get values from all forms
    const storeData = storeForm.getValues()
    const lineOAData = lineOAForm.getValues()

    // Create the final store object
    const storeObject = {
      storeName: storeData.storeName,
      phone: storeData.phone,
      address: storeData.address || "",
      isCash: storeData.isCash,
      openingStatus: storeData.openingStatus,
      openingHours:
        storeData.openingStatus === "OPEN_WITH_TIME" ? openingHours : [],
      accounts: accounts,
      lineOABot: lineOAData,
    }

    // Log the complete store object
    console.log("Creating store:", JSON.stringify(storeObject, null, 2))
    try {
      // change to createStore schema
      const createStoreObject = {
        storeName: storeObject.storeName,
        phone: storeObject.phone,
        address: storeObject.address,
        isCash: storeObject.isCash,
        openingStatus: storeObject.openingStatus,
        openingHours: storeObject.openingHours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          openingTime: hour.openingTime,
          closingTime: hour.closingTime,
          closed: hour.closed,
        })),
        accounts: storeObject.accounts,
        lineOABot: storeObject.lineOABot,
      } as CreateStore
      setIsCreateLoading(true)
      const response = await createStore(createStoreObject)
      setIsCreateLoading(false)
      // const response = await getStore("67b3936e1cd3d4c2c25f4e19")
      console.log(response)
      if (!response.success) {
        toast.error("Error creating store:", {
          description: response.message,
        })
        return
      }
      setWebhookUrl(
        import.meta.env.VITE_API_URL + "/callback/" + response.data.id,
      )
    } catch (error) {
      console.error("Error creating store:", error)
    }
    // handleFetchTest()

    // Show success message
    toast.success("Store created", {
      description: "Your store has been created successfully!",
    })

    // setWebhookUrl(import.meta.env.VITE_API_URL + "/api/webhook")
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Top Bar */}
      <Topbar />

      {/* Stepper */}
      <div className="container mx-auto max-w-md px-4 py-6 pb-24">
        <h1 className="mb-4 text-2xl font-semibold">สร้างร้านค้าใหม่</h1>
        {/* New Stepper */}
        <div className="mb-8">
          <Stepper value={step} onValueChange={setStep}>
            {stepLabels.map((item) => {
              const Icon = item.icon
              return (
                <StepperItem
                  key={item.step}
                  step={item.step}
                  className="relative flex-1 flex-col!"
                >
                  <StepperTrigger className="flex-col gap-3 rounded">
                    <StepperIndicator asChild className="h-10 w-10">
                      <Icon className="h-5 w-5" />
                    </StepperIndicator>
                    <div className="space-y-0.5 px-2">
                      <StepperTitle>{item.label}</StepperTitle>
                    </div>
                  </StepperTrigger>
                  {item.step < stepLabels.length && (
                    <StepperSeparator className="absolute inset-x-0 top-5 left-[calc(50%+0.75rem+0.75rem)] -order-1 m-0 -translate-y-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-2.5rem-0.5rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
                  )}
                </StepperItem>
              )
            })}
          </Stepper>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {step === 1 && (
            <Card className="p-4">
              <Form {...storeForm}>
                <form className="space-y-4">
                  <FormField
                    control={storeForm.control}
                    name="storeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter store name"
                            className="h-15"
                            {...field}
                          />
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
                          <Input placeholder="Enter phone number" {...field} />
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
                          <Textarea
                            placeholder="Enter store address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={storeForm.control}
                    name="isCash"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 py-2">
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
                      <FormItem className="space-y-2">
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
                      <h3 className="font-medium">Opening Hours</h3>

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
            </Card>
          )}

          {step === 2 && (
            <>
              <Card className="p-4">
                <div className={showAccountForm ? "space-y-4" : ""}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Payment Accounts</h2>
                    {!showAccountForm && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAccountForm(true)
                          setEditingAccountIndex(null)
                          if (selectedAccountType === "BANK") {
                            bankAccountForm.reset({
                              receiverType: "BANK",
                              receiverBank: "",
                              receiverAccount: "",
                              accountNameTh: "",
                              accountNameEn: "",
                              promptpayId: null,
                            })
                          } else {
                            promptpayAccountForm.reset({
                              receiverType: "PROMPTPAY",
                              promptpayId: "",
                              accountNameTh: "",
                              accountNameEn: "",
                              receiverBank: null,
                              receiverAccount: null,
                            })
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Account
                      </Button>
                    )}
                  </div>

                  {/* Account list */}
                  {accounts.length > 0 ? (
                    <div className="space-y-3">
                      {accounts.map((account, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between gap-4 px-4">
                            <div className="space-y-0.5">
                              <p className="text-muted-foreground text-xs">
                                บัญชี
                              </p>
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
                                  <h2 className="text-2xl font-bold">
                                    พร้อมเพย์
                                  </h2>
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
                                  onClick={() => handleEditAccount(index)}
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
                      ))}
                    </div>
                  ) : !showAccountForm ? (
                    <Card className="flex flex-col items-center justify-center border-dashed p-6">
                      <div className="bg-muted mb-4 rounded-full p-3">
                        <CreditCard className="text-muted-foreground h-6 w-6" />
                      </div>
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
                  ) : null}

                  {/* Account form */}
                  {showAccountForm && (
                    <>
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
                                      promptpayId: null,
                                    })
                                  } else {
                                    promptpayAccountForm.reset({
                                      receiverType: "PROMPTPAY",
                                      promptpayId: "",
                                      accountNameTh: "",
                                      accountNameEn: "",
                                      receiverBank: null,
                                      receiverAccount: null,
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

                      <Card className="p-4">
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">
                            {editingAccountIndex !== null
                              ? "Edit Account"
                              : "Add New Account"}
                          </h3>

                          {selectedAccountType === "BANK" ? (
                            <Form
                              {...bankAccountForm}
                              key={`bank-form-${showAccountForm}`}
                            >
                              <form
                                className="space-y-4"
                                key={`bank-form-${showAccountForm}`}
                              >
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
                                              {Object.values(banks).map(
                                                (bank) => (
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
                                                        {bank.name} (
                                                        {bank.symbol})
                                                      </span>
                                                    </div>
                                                  </SelectItem>
                                                ),
                                              )}
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
                                      <FormLabel>
                                        Account Name (English)
                                      </FormLabel>
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
                                    {editingAccountIndex !== null
                                      ? "Update"
                                      : "Add"}{" "}
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
                              <form
                                className="space-y-4"
                                key={`promptpay-form-${showAccountForm}`}
                              >
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
                                      <FormLabel>
                                        Account Name (English)
                                      </FormLabel>
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
                                    {editingAccountIndex !== null
                                      ? "Update"
                                      : "Add"}{" "}
                                    Account
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          )}
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              </Card>
            </>
          )}

          {step === 3 && (
            <>
              <Card className="p-4">
                <Form {...lineOAForm}>
                  <form className="space-y-4">
                    <h2 className="text-xl font-semibold">
                      Line OA Information
                    </h2>

                    {/* <FormField
                    control={lineOAForm.control}
                    name="botId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter Line OA Bot ID"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={lineOAForm.control}
                    name="basicId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Basic ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter Line OA Basic ID"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={lineOAForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter Line OA Display Name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  /> */}

                    <FormField
                      control={lineOAForm.control}
                      name="channelSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel Secret</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter Channel Secret"
                              {...field}
                            />
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
                            <Input
                              type="password"
                              placeholder="Enter Channel Access Token"
                              {...field}
                            />
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
                          value={
                            !webhookUrl
                              ? "waiting to create store..."
                              : webhookUrl
                          }
                          className="rounded-r-none"
                        />
                        <Button
                          variant="outline"
                          className="rounded-l-none border-l-0"
                          onClick={copyToClipboard}
                          type="button"
                          disabled={!webhookUrl}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Use this URL in your Line OA settings
                      </p>
                    </div>

                    <Button className="flex w-full items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download Documentation
                    </Button>
                  </form>
                </Form>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-4 left-0 w-full px-4">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              className="w-full"
              size="lg"
            >
              Back
            </Button>
          ) : (
            <div></div> // Empty space
          )}

          {step < 3 ? (
            <Button onClick={handleNext} className="w-full" size="lg">
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button className="w-full" size="lg" onClick={handleCreateStore}>
                Create Store
              </Button>
              <Dialog
                open={!isCreateLoading}
                onOpenChange={(open) => {
                  // setIsDialogOpen(open)
                  if (!open) {
                    window.location.href = "/"
                  }
                }}
              >
                <DialogTrigger asChild></DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>สร้างร้านค้าเสร็จสิ้น</DialogTitle>
                    <DialogDescription>
                      คุณสามารถนำ Webhook URL ไปใช้งานใน Line OA ของคุณ
                    </DialogDescription>
                  </DialogHeader>
                  <div className="pt-4">
                    <Label className="text-muted-foreground text-sm">
                      Webhook URL
                    </Label>
                    <div className="mt-1 flex">
                      <Input
                        readOnly
                        value={
                          !webhookUrl
                            ? "waiting to create store..."
                            : webhookUrl
                        }
                        className="rounded-r-none"
                      />
                      <Button
                        variant="outline"
                        className="rounded-l-none border-l-0"
                        onClick={copyToClipboard}
                        type="button"
                        disabled={!webhookUrl}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Use this URL in your Line OA settings
                    </p>
                  </div>

                  <Button className="flex w-full items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Documentation
                  </Button>
                  <DialogFooter className="sm:justify-start">
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = "/"
                        }}
                      >
                        Back to home
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
