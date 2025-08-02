"use client"



import { useEffect, useState } from "react"
import { ScanLine, X, Plus, CircleUserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
} from "../../components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"
import { compressImage } from "@/lib/compressImg"
import {
  getStoreIngredients,
  ocr,
  getStoreProducts,
  createStoreReceipt,
  uploadReceiptImage,
} from "@/api/store"
import { useParams } from "react-router-dom"
import {
  Ingredient,
  CreateReceipt,
  ReceiptIngredient,
  Product,
  ReceiptProduct,
} from "@/types"
import { SelectGroup } from "@radix-ui/react-select"

type SelectedOcrIngredient = ReceiptIngredient & {
  isExisting: boolean
  customUnit: string
  originalQuantity: number
  convertedQuantity?: number
}

type StandardUnitCategory = {
  weight: {
    base_unit: string
    units: string[]
  }
  volume: {
    base_unit: string
    units: string[]
  }
  count: {
    base_unit: string
    units: string[]
  }
}

type UnitMappingInfo = {
  standard_unit: string
  category: "weight" | "volume" | "count"
  conversion_ratio: number
}

type UnitMapping = {
  [key: string]: UnitMappingInfo
}

const STD_UNIT: StandardUnitCategory = {
  weight: {
    base_unit: "g",
    units: ["kg", "g", "mg", "lb", "oz"],
  },
  volume: {
    base_unit: "ml",
    units: ["ml", "l", "pt", "qt", "gal", "tsp", "tbsp", "cup"],
  },
  count: {
    base_unit: "unit",
    units: ["unit", "sheet", "piece", "tray", "pack", "bottle", "slice"],
  },
}

// Unit conversion mapping
const unitMapping: UnitMapping = {
  g: { standard_unit: "g", category: "weight", conversion_ratio: 1 },
  gram: { standard_unit: "g", category: "weight", conversion_ratio: 1 },
  กรัม: { standard_unit: "g", category: "weight", conversion_ratio: 1 },
  "ก.": { standard_unit: "g", category: "weight", conversion_ratio: 1 },
  ก: { standard_unit: "g", category: "weight", conversion_ratio: 1 },

  kg: { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },
  kilo: { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },
  kilogram: { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },
  กิโลกรัม: { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },
  "กก.": { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },
  กก: { standard_unit: "kg", category: "weight", conversion_ratio: 1000 },

  mg: { standard_unit: "mg", category: "weight", conversion_ratio: 0.001 },
  milligram: {
    standard_unit: "mg",
    category: "weight",
    conversion_ratio: 0.001,
  },
  มิลลิกรัม: {
    standard_unit: "mg",
    category: "weight",
    conversion_ratio: 0.001,
  },
  "มก.": { standard_unit: "mg", category: "weight", conversion_ratio: 0.001 },
  มก: { standard_unit: "mg", category: "weight", conversion_ratio: 0.001 },

  // Imperial/US system
  lb: { standard_unit: "lb", category: "weight", conversion_ratio: 453.592 },
  pound: { standard_unit: "lb", category: "weight", conversion_ratio: 453.592 },
  ปอนด์: { standard_unit: "lb", category: "weight", conversion_ratio: 453.592 },

  oz: { standard_unit: "oz", category: "weight", conversion_ratio: 28.3495 },
  ounce: { standard_unit: "oz", category: "weight", conversion_ratio: 28.3495 },
  ออนซ์: { standard_unit: "oz", category: "weight", conversion_ratio: 28.3495 },

  // Volume
  ml: { standard_unit: "ml", category: "volume", conversion_ratio: 1 },
  milliliter: { standard_unit: "ml", category: "volume", conversion_ratio: 1 },
  "มล.": { standard_unit: "ml", category: "volume", conversion_ratio: 1 },
  มิลลิลิตร: { standard_unit: "ml", category: "volume", conversion_ratio: 1 },
  มล: { standard_unit: "ml", category: "volume", conversion_ratio: 1 },

  l: { standard_unit: "l", category: "volume", conversion_ratio: 1000 },
  liter: { standard_unit: "l", category: "volume", conversion_ratio: 1000 },
  "ล.": { standard_unit: "l", category: "volume", conversion_ratio: 1000 },
  ลิตร: { standard_unit: "l", category: "volume", conversion_ratio: 1000 },
  ล: { standard_unit: "l", category: "volume", conversion_ratio: 1000 },

  pt: { standard_unit: "pt", category: "volume", conversion_ratio: 473.176 },
  pint: { standard_unit: "pt", category: "volume", conversion_ratio: 473.176 },
  ไพนต์: { standard_unit: "pt", category: "volume", conversion_ratio: 473.176 },

  qt: { standard_unit: "qt", category: "volume", conversion_ratio: 946.353 },
  quart: { standard_unit: "qt", category: "volume", conversion_ratio: 946.353 },
  ควอร์ต: {
    standard_unit: "qt",
    category: "volume",
    conversion_ratio: 946.353,
  },

  gal: { standard_unit: "gal", category: "volume", conversion_ratio: 3785.41 },
  gallon: {
    standard_unit: "gal",
    category: "volume",
    conversion_ratio: 3785.41,
  },
  แกลลอน: {
    standard_unit: "gal",
    category: "volume",
    conversion_ratio: 3785.41,
  },

  // US Customary
  tsp: { standard_unit: "tsp", category: "volume", conversion_ratio: 4.92892 },
  teaspoon: {
    standard_unit: "tsp",
    category: "volume",
    conversion_ratio: 4.92892,
  },
  ช้อนชา: {
    standard_unit: "tsp",
    category: "volume",
    conversion_ratio: 4.92892,
  },

  tbsp: {
    standard_unit: "tbsp",
    category: "volume",
    conversion_ratio: 14.7868,
  },
  tablespoon: {
    standard_unit: "tbsp",
    category: "volume",
    conversion_ratio: 14.7868,
  },
  ช้อนโต๊ะ: {
    standard_unit: "tbsp",
    category: "volume",
    conversion_ratio: 14.7868,
  },

  cup: {
    standard_unit: "cup",
    category: "volume",
    conversion_ratio: 236.588,
  },
  ถ้วยตวง: {
    standard_unit: "cup",
    category: "volume",
    conversion_ratio: 236.588,
  },

  // Quantity custom unit
  unit: {
    standard_unit: "unit",
    category: "count",
    conversion_ratio: 1,
  },
  ฟอง: {
    standard_unit: "unit",
    category: "count",
    conversion_ratio: 1,
  },
  tray: {
    standard_unit: "tray",
    category: "count",
    conversion_ratio: 30,
  },
  แผง: {
    standard_unit: "tray",
    category: "count",
    conversion_ratio: 30,
  },
  pack: {
    standard_unit: "pack",
    category: "count",
    conversion_ratio: 1,
  },
  แพ็ค: {
    standard_unit: "pack",
    category: "count",
    conversion_ratio: 1,
  },
  ขวด: {
    standard_unit: "bottle",
    category: "count",
    conversion_ratio: 1,
  },
  bottle: {
    standard_unit: "bottle",
    category: "count",
    conversion_ratio: 1,
  },

  sheet: { standard_unit: "sheet", category: "count", conversion_ratio: 1 },
  แผ่น: { standard_unit: "sheet", category: "count", conversion_ratio: 1 },

  slice: { standard_unit: "slice", category: "count", conversion_ratio: 1 },
  piece: { standard_unit: "piece", category: "count", conversion_ratio: 1 },
  ชิ้น: { standard_unit: "piece", category: "count", conversion_ratio: 1 },
}

const normalizeUnit = async (
  customUnit: string,
  originalQuantity: number,
  toUnit: string,
): Promise<{
  unit: string
  quantity: number
}> => {
  const normalizedCustomUnit = customUnit.toLowerCase().trim()
  const normalizedToUnit = toUnit.toLowerCase().trim()

  if (normalizedCustomUnit === normalizedToUnit)
    return { unit: normalizedToUnit, quantity: originalQuantity }

  const unitMappingFrom = unitMapping[normalizedCustomUnit]
  if (!unitMappingFrom) return { unit: toUnit, quantity: originalQuantity }

  console.log("got: ", customUnit, "change to:", unitMappingFrom.standard_unit)
  console.log("to unit: ", normalizedToUnit)
  // convert to toUnit
  const unitMappingTo = unitMapping[normalizedToUnit]
  console.log("unitMappingTo", unitMappingTo)
  // can't change to unit that doesn't exist
  if (!unitMappingTo)
    return {
      unit: unitMappingFrom.standard_unit,
      quantity: originalQuantity,
    }
  // From qty -> ml -> toUnit
  const calculatedQuantity =
    (originalQuantity * unitMappingFrom.conversion_ratio) /
    unitMappingTo.conversion_ratio

  return {
    unit: unitMappingTo.standard_unit,
    quantity: calculatedQuantity,
  }
}

const getUnit = (
  customUnit: string,
  originalQuantity: number,
): {
  unit: string
  quantity: number
} => {
  const normalizedCustomUnit = customUnit.toLowerCase().trim()
  console.log("customUnit", customUnit)
  console.log("normalizedCustomUnit", normalizedCustomUnit)
  const unitMappingFrom = unitMapping[normalizedCustomUnit]
  if (!unitMappingFrom) return { unit: customUnit, quantity: originalQuantity }
  return {
    unit: unitMappingFrom.standard_unit,
    quantity: originalQuantity,
  }
}

export default function IngredientOCR() {
  const { storeId } = useParams()
  const [scanning, setScanning] = useState(false)
  const [scannedIngredients, setScannedIngredients] = useState<
    SelectedOcrIngredient[]
  >([])
  const [existingIngredients, setExistingIngredients] = useState<Ingredient[]>(
    [],
  )
  const [selectedProducts, setSelectedProducts] = useState<{
    [key: string]: string
  }>({})

  // const [selectedIngredients, setSelectedIngredients] = useState<
  //   SelectedOcrIngredient[]
  // >([])
  const {
    previewUrl,
    fileInputRef,
    handleThumbnailClick: handleButtonClick,
    handleFileChange,
    handleRemove,
    fileName,
    file,
  } = useImageUpload()
  // const [scanConfidence, setScanConfidence] = useState(0)
  const [receipts, setReceipts] = useState<CreateReceipt>()
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [selectedIngredients, setSelectedIngredients] = useState<
    Map<string, ReceiptProduct[]>
  >(new Map())

  useEffect(() => {
    if (!storeId) return
    const fetchProducts = async () => {
      const response = await getStoreProducts(storeId)
      setProducts(
        new Map(response.data.products.map((product) => [product.id, product])),
      )
    }
    const fetchIngredients = async () => {
      const response = await getStoreIngredients(storeId)
      setExistingIngredients(response.data.ingredients)
      // DEBUG
      // setExistingIngredients([
      //   {
      //     id: "67c57265ddd44d3be965dc85",
      //     name: "เนื้อหมู",
      //     quantity: 302,
      //     unit: "kg",
      //     createdAt: "2025-03-03T09:12:05.133Z",
      //     updatedAt: "2025-04-01T08:36:39.300Z",
      //     productIDs: ["67bec8b4b9483827dcf0c05b", "67e78fc42979006013f4aada"],
      //   },
      //   {
      //     id: "67e9b7850cf317b432792eca",
      //     name: "ไข่ไก่",
      //     quantity: 0,
      //     unit: "unit",
      //     createdAt: "2025-03-30T21:28:37.447Z",
      //     updatedAt: "2025-03-30T22:10:19.676Z",
      //     receiptInfo: [],
      //     receipts: [],
      //     productIDs: ["67c574ebf92230f2b09836b7"],
      //   },
      // ])
    }
    fetchProducts()
    fetchIngredients()
  }, [storeId])

  const similarityIngredient = (
    ingredientName: string,
    ocrIngredientName: string,
  ) => {
    const ingredientNameLower = ingredientName.toLowerCase()
    const ocrIngredientNameLower = ocrIngredientName.toLowerCase()

    if (ingredientNameLower === ocrIngredientNameLower) return true

    // split by space
    const ingredientNameSplit = ingredientNameLower.split(" ")
    const ocrIngredientNameSplit = ocrIngredientNameLower.split(" ")

    if (
      ingredientNameSplit.some((name) => ocrIngredientNameSplit.includes(name))
    )
      return true
    else if (
      ocrIngredientNameSplit.some((name) => ingredientNameSplit.includes(name))
    )
      return true

    return false
  }

  // test similarityIngredient
  // console.log(similarityIngredient("เนื้อหมู", "เนื้อหมู (Prok)")) // should be true
  // console.log(similarityIngredient("เนื้อหมู", "เนื้อหมูกรอบ")) // should be false

  const handleScan = async () => {
    if (!fileName || !file || !storeId) {
      toast.error("Please upload a bill image first")
      return
    }

    try {
      setScanning(true)

      // Compress image
      const compressedFile = await compressImage(file, 2, 0.95)

      // Create FormData and append the compressed file
      const formData = new FormData()
      formData.append("image", compressedFile)

      // Call OCR API
      const response = await ocr(storeId, formData)
      // const response = {
      //   success: true,
      //   data: {
      //     path: "public/ocr/67bec698b9483827dcf0c05a.png",
      //     ocrText:
      //       "ใบเสร็จรับเงิน (Receipt)\n\nMakro สาขาบางบัวทอง\n\nเลขที่ใบเสร็จ: 123456789\n\nวันที่: 31 มีนาคม 2025\n\nเวลา: 14:30 น.\nรายการสินค้าจํานวนราคาต่อหน่วย (บาท) ราคารวม (บาท)\nเนื้อหมู (0 ก0 2กก. 150 300\n“ald (Eggs) 1แพ็ค 120 120\n‘una (Fresh Milk) 2 ลิตร 65 130\nข้าวสาร Rice) 5 กก. 250 250\nน้าปลา (Fish Sauce) 1ma 45 a5\n#Ainmaz (Chinese Cabbage) 1 กก. 40 40\n\nยยอดรวม (โอ1๑ ): 885 บาท\n\nภาษีมูลค่าเพิ่ม (VAT 7%): 61.95 บาท\n\nรวมทั้งหมด (Grand Total): 946.95 บาท\n\nวิธีซําระเงิน: เงินสด (Cash)\n\nขอบคุณที่ใช้บริการแม็คโคร\n\n(Makro Thank you for your purchase!)\n\nWrite something",
      //     ocrConfidence: 91,
      //     extractedData: {
      //       items: [
      //         {
      //           confidence: 0.9,
      //           description: "เนื้อหมู",
      //           quantity: 2,
      //           total_price: 300,
      //           unit: "กก.",
      //           unit_price: 150,
      //         },
      //         {
      //           confidence: 0.7,
      //           description: "ไข่ไก่",
      //           quantity: 1,
      //           total_price: 120,
      //           unit: "แผง",
      //           unit_price: 120,
      //         },
      //         {
      //           confidence: 0.6,
      //           description: "น้ำปลา",
      //           quantity: 1,
      //           total_price: 45,
      //           unit: "ขวด",
      //           unit_price: 45,
      //         },
      //       ],
      //       merchant_name: "Makro",
      //       receipt_number: "123456789",
      //       transaction_date: "2025-03-31",
      //     },
      //     createdAt: "2025-03-30T18:20:07.038Z",
      //   },
      //   message: "Receipt analyzed successfully",
      //   timestamp: "3/31/2025, 1:20:07 AM",
      // }

      console.log(response)

      if (response.success && response.data) {
        // setExitingIngredients(existingIngredients.data.ingredients)
        // Transform OCR response into Ingredient format, filtering out low confidence items
        const ingredients: SelectedOcrIngredient[] = []
        console.log("existingIngredients", existingIngredients)
        for (const [
          index,
          ingredient,
        ] of response.data.extractedData.items.entries()) {
          const FindExistingIngredient = existingIngredients.find((ing) =>
            similarityIngredient(ing.name, ingredient.description),
          )
          if (FindExistingIngredient) {
            // Convert quantity to standard unit if needed
            const { unit, quantity } = await normalizeUnit(
              ingredient.unit,
              ingredient.quantity,
              FindExistingIngredient.unit,
            )

            ingredients.push({
              name: FindExistingIngredient.name,
              unit: unit,
              quantity: quantity,
              isExisting: true,
              ingId: FindExistingIngredient.id,
              products:
                FindExistingIngredient.productIDs?.map((productId: string) => ({
                  pdId: productId,
                  quantity:
                    products
                      .get(productId)
                      ?.ingredientInfo?.find(
                        (e) => e.ingredientId === FindExistingIngredient.id,
                      )?.ingredientQuantity || 0,
                  isEdit: false,
                })) || [],
              price: ingredient.unit_price,
              customUnit: ingredient.unit, // Store original unit
              originalQuantity: ingredient.quantity, // Store original quantity
            })
          } else {
            const { unit, quantity } = getUnit(
              ingredient.unit,
              ingredient.quantity,
            )
            ingredients.push({
              name: ingredient.description,
              quantity: quantity,
              unit: unit,
              products: [],
              ingId: `mockup-${index}`,
              price: ingredient.unit_price,
              isExisting: false,
              customUnit: ingredient.unit,
              originalQuantity: ingredient.quantity,
            })
          }
        }
        setReceipts({
          imageUrl: "",
          store: response.data.extractedData.merchant_name,
          receiptsRef: response.data.extractedData.receipt_number,
          receiptsDate: response.data.extractedData.transaction_date,
          ingredients: [],
        })
        // setScanConfidence(response.data.ocrConfidence)
        setScannedIngredients(ingredients)
        setSelectedIngredients(
          new Map(
            ingredients.map((ingredient) => [
              ingredient.ingId,
              ingredient.products,
            ]),
          ),
        )
        console.log(ingredients)
        toast.success("Bill scanned successfully")
      } else {
        toast.error(response.message || "Failed to scan bill")
      }
    } catch (error) {
      console.error("Error scanning bill:", error)
      toast.error("Failed to scan bill. Please try again.")
    } finally {
      setScanning(false)
    }
  }

  const handleAddIngredientToProduct = (
    ingredientId: string,
    productId: string,
  ) => {
    if (!productId) {
      toast.error("Please select a product")
      return
    }

    const product = products.get(productId)
    if (!product) return

    // Add the selected ingredient to the product
    const selectedIngredient = scannedIngredients.find(
      (ing) => ing.ingId === ingredientId,
    )

    if (
      selectedIngredients
        .get(ingredientId)
        ?.find((product) => product.pdId === productId)
    ) {
      toast.error(`${selectedIngredient?.name} already in ${product.name}`)
      return
    } else {
      selectedIngredients.get(ingredientId)?.push({
        pdId: productId,
        quantity: 1,
        isEdit: true,
      })
      setSelectedIngredients(new Map(selectedIngredients))
    }

    toast.success(`Added ${selectedIngredient?.name} to ${product.name}`)
    console.log(selectedIngredients)
    // setSelectedProduct("")
  }

  const handleRemoveScannedIngredient = (index: number) => {
    const newScannedIngredients = [...scannedIngredients]
    newScannedIngredients.splice(index, 1)
    setScannedIngredients(newScannedIngredients)
  }

  const handleSaveIngredients = async () => {
    if (!storeId) return

    // Check if any ingredient has no products assigned
    const ingredientsWithoutProducts = scannedIngredients.filter(
      (ingredient) => !selectedIngredients.get(ingredient.ingId)?.length,
    )
    const ingredientsWithQuantityZero = scannedIngredients.filter(
      (ingredient) => ingredient.quantity < 1,
    )
    if (ingredientsWithQuantityZero.length > 0) {
      const ingredientNames = ingredientsWithQuantityZero
        .map((ing) => ing.name)
        .join(", ")
      toast.error(
        `Please enter a quantity greater than 0 for the following ingredients: ${ingredientNames}`,
      )
      return
    }

    if (ingredientsWithoutProducts.length > 0) {
      const ingredientNames = ingredientsWithoutProducts
        .map((ing) => ing.name)
        .join(", ")
      toast.error(
        `Please assign products to the following ingredients: ${ingredientNames}`,
      )
      return
    }

    // copy ingredients to receipts with new fields
    const receiptsWithIngredients: CreateReceipt = {
      imageUrl: undefined,
      store: receipts?.store || "",
      receiptsRef: receipts?.receiptsRef || "",
      receiptsDate: receipts?.receiptsDate || "",
      ingredients: scannedIngredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        price: ingredient.price,
        ingId: ingredient.ingId,
        products: selectedIngredients.get(ingredient.ingId) || [],
        customUnit: ingredient.unit, // Use the unit as customUnit initially
        originalQuantity: ingredient.quantity, // Use the same quantity as original
        quantityUsed: 0, // Initialize as 0
        receiptUsedOrder: [], // Initialize empty array
        isActive: true, // Set as active by default
      })),
    }
    console.log(receiptsWithIngredients)
    // return
    const response = await createStoreReceipt(storeId, receiptsWithIngredients)
    console.log(response)
    // return
    // const response = {
    //   success: true,
    //   data: {
    //     id: "67e9b7850cf317b432792ec9",
    //   },
    //   message: "Receipt created successfully",
    // }
    if (response.success) {
      toast.success("Receipt created successfully")
      setReceipts(undefined)
      setScannedIngredients([])
      setSelectedIngredients(new Map())
      // fetch new ingredients
      const fetchIngredients = async () => {
        const response = await getStoreIngredients(storeId)
        setExistingIngredients(response.data.ingredients)
      }
      fetchIngredients()
      const receiptId = response.data.id
      if (file) {
        const compressedFile = await compressImage(file, 2, 0.95)

        // Create FormData and append the compressed file
        const formData = new FormData()
        formData.append("image", compressedFile)
        const imageResponse = await uploadReceiptImage(
          storeId,
          receiptId,
          formData,
        )
        console.log(imageResponse)
        if (imageResponse.success) {
          toast.success("Receipt image uploaded successfully")
        } else {
          toast.error(imageResponse.message || "Failed to upload receipt image")
        }
      }
    } else {
      toast.error(response.message || "Failed to create receipt")
    }
  }

  const handleNameChange = (index: number, newName: string) => {
    const updatedIngredients = [...scannedIngredients]
    updatedIngredients[index].name = newName
    setScannedIngredients(updatedIngredients)
  }

  const handleNameBlur = (index: number, newName: string) => {
    const updatedIngredients = [...scannedIngredients]

    // Check if the ingredient exists
    const existingIngredient = existingIngredients.find((ing) =>
      similarityIngredient(ing.name, newName),
    )

    if (existingIngredient) {
      updatedIngredients[index].isExisting = true
      updatedIngredients[index].ingId = existingIngredient.id
      updatedIngredients[index].products =
        existingIngredient.productIDs?.map((productId: string) => ({
          pdId: productId,
          quantity:
            products
              .get(productId)
              ?.ingredientInfo?.find(
                (e) => e.ingredientId === existingIngredient.id,
              )?.ingredientQuantity || 0,
          isEdit: false,
        })) || []
    } else {
      updatedIngredients[index].isExisting = false
      updatedIngredients[index].ingId = `mockup-${index}`
      updatedIngredients[index].products = []
    }
    console.log("updatedIngredients", updatedIngredients)
    setSelectedIngredients(
      new Map(
        updatedIngredients.map((ingredient) => [
          ingredient.ingId,
          ingredient.products,
        ]),
      ),
    )
    setScannedIngredients(updatedIngredients)
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Ingredient OCR</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Bill</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Button
                      onClick={handleButtonClick}
                      aria-haspopup="dialog"
                      className="w-full"
                      variant="outline"
                    >
                      {fileName ? "Change image" : "Upload image"}
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                      aria-label="Upload image file"
                    />
                  </div>
                  <Button onClick={handleScan} disabled={!fileName || scanning}>
                    {scanning ? (
                      <>
                        <ScanLine className="mr-2 h-4 w-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <ScanLine className="mr-2 h-4 w-4" />
                        Scan Bill
                      </>
                    )}
                  </Button>
                </div>
                <div
                  className={`border-input relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border ${
                    previewUrl ? "" : "hidden"
                  }`}
                  aria-label={
                    previewUrl
                      ? "Preview of uploaded image"
                      : "Default user avatar"
                  }
                >
                  {previewUrl ? (
                    <img
                      className="h-full w-full object-cover"
                      src={previewUrl}
                      alt="Preview of uploaded image"
                    />
                  ) : (
                    <div aria-hidden="true">
                      <CircleUserRoundIcon className="opacity-60" size={16} />
                    </div>
                  )}
                </div>
              </div>
              {fileName && (
                <div className="mt-2">
                  <div className="inline-flex gap-2 text-xs">
                    <p
                      className="text-muted-foreground truncate"
                      aria-live="polite"
                    >
                      {fileName}
                    </p>{" "}
                    <button
                      onClick={handleRemove}
                      className="font-medium text-red-500 hover:underline"
                      aria-label={`Remove ${fileName}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <div className="sr-only" aria-live="polite" role="status">
                {previewUrl
                  ? "Image uploaded and preview available"
                  : "No image uploaded"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {scannedIngredients.length > 0 && (
        <div className="space-y-4">
          {/* <div>
            <h2 className="text-lg font-medium">Scanned Ingredients</h2>
            <p className="text-muted-foreground text-sm">
              Confidence: {scanConfidence}%
            </p>
          </div> */}

          <Card>
            <CardHeader>
              <CardTitle>
                <Badge variant="default">Receipt Info</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label htmlFor={`receipt-store`}>Store</Label>
                <Input
                  id={`receipt-store`}
                  type="text"
                  value={receipts?.store}
                  onChange={(e) => {
                    const new_rp = { ...receipts }
                    new_rp.store = e.target.value
                    setReceipts(new_rp as CreateReceipt)
                  }}
                />
                <Label htmlFor={`receipt-number`}>Receipt Number</Label>
                <Input
                  id={`receipt-number`}
                  type="text"
                  value={receipts?.receiptsRef}
                  onChange={(e) => {
                    const new_rp = { ...receipts }
                    new_rp.receiptsRef = e.target.value
                    setReceipts(new_rp as CreateReceipt)
                  }}
                />
                <Label htmlFor={`receipt-date`}>Receipt Date</Label>
                <Input
                  id={`receipt-date`}
                  type="date"
                  max={
                    new Date(new Date().setDate(new Date().getDate() + 1))
                      .toISOString()
                      .split("T")[0]
                  }
                  value={receipts?.receiptsDate.split("T")[0]}
                  onChange={(e) => {
                    const new_rp = { ...receipts }
                    new_rp.receiptsDate = e.target.value
                    setReceipts(new_rp as CreateReceipt)
                  }}
                />
              </div>
            </CardContent>
          </Card>
          {scannedIngredients.map((ingredient, index) => (
            <Card key={ingredient.ingId} className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => handleRemoveScannedIngredient(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              <CardContent className="">
                <div className="space-y-3">
                  <Badge
                    variant={ingredient.isExisting ? "default" : "outline"}
                  >
                    {ingredient.isExisting ? "Existing" : "New"}
                  </Badge>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor={`ingredient-name-${index}`}>Name</Label>
                      <Input
                        id={`ingredient-name-${index}`}
                        value={ingredient.name}
                        onChange={(e) =>
                          handleNameChange(index, e.target.value)
                        }
                        onBlur={(e) => handleNameBlur(index, e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-quantity-${index}`}>
                        Quantity
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`ingredient-quantity-${index}`}
                          type="number"
                          value={ingredient.quantity}
                          onChange={(e) => {
                            const newIngredients = [...scannedIngredients]
                            newIngredients[index].quantity = Number.parseFloat(
                              e.target.value,
                            )
                            setScannedIngredients(newIngredients)
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-unit-${index}`}>Unit</Label>
                      <Select
                        value={ingredient.unit}
                        onValueChange={async (e) => {
                          const { unit, quantity } = await normalizeUnit(
                            ingredient.unit,
                            ingredient.quantity,
                            e,
                          )
                          const newIngredients = [...scannedIngredients]
                          newIngredients[index].unit = unit
                          newIngredients[index].quantity = Number.parseFloat(
                            quantity.toFixed(4),
                          )
                          setScannedIngredients(newIngredients)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(STD_UNIT).map((baseUnit: string) => (
                            <SelectGroup key={baseUnit}>
                              <SelectLabel className="text-muted-foreground">
                                {baseUnit}
                              </SelectLabel>
                              {STD_UNIT[
                                baseUnit as keyof StandardUnitCategory
                              ].units.map((unit: string) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-custom-unit-${index}`}>
                        Custom Unit
                      </Label>
                      <Input
                        id={`ingredient-custom-unit-${index}`}
                        value={ingredient.customUnit || ""}
                        placeholder="Enter custom unit"
                        onChange={async (e) => {
                          const newIngredients = [...scannedIngredients]
                          const inputValue = e.target.value
                          newIngredients[index].customUnit = inputValue

                          const currentIngredient = newIngredients[index]

                          // If it's an existing ingredient, try to convert the quantity
                          if (currentIngredient.isExisting && inputValue) {
                            const { unit, quantity } = await normalizeUnit(
                              inputValue,
                              currentIngredient.originalQuantity,
                              currentIngredient.unit,
                            )
                            newIngredients[index].unit = unit
                            newIngredients[index].quantity = quantity
                          }
                          console.log("newIngredients", newIngredients)
                          setScannedIngredients(newIngredients)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-original-quantity-${index}`}>
                        Original Quantity
                      </Label>
                      <Input
                        min={1}
                        id={`ingredient-original-quantity-${index}`}
                        type="number"
                        value={ingredient.originalQuantity || ""}
                        placeholder="Enter original quantity"
                        onChange={async (e) => {
                          const newIngredients = [...scannedIngredients]
                          newIngredients[index].originalQuantity =
                            Number.parseFloat(e.target.value)
                          // If it's an existing ingredient and we have a custom unit, try to convert
                          if (ingredient.isExisting && ingredient.customUnit) {
                            const { unit, quantity } = await normalizeUnit(
                              ingredient.customUnit,
                              Number.parseFloat(e.target.value),
                              ingredient.unit,
                            )
                            newIngredients[index].unit = unit
                            newIngredients[index].quantity = Number.parseFloat(
                              quantity.toFixed(4),
                            )
                          }
                          setScannedIngredients(newIngredients)
                        }}
                      />
                    </div>
                  </div>

                  {ingredient.isExisting && ingredient.convertedQuantity && (
                    <div className="text-muted-foreground text-sm">
                      Converted to: {ingredient.convertedQuantity}{" "}
                      {ingredient.unit}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor={`ingredient-price-${index}`}>
                      Price per {ingredient.unit}
                    </Label>
                    <Input
                      id={`ingredient-price-${index}`}
                      type="number"
                      value={ingredient.price || 0}
                      onChange={(e) => {
                        const newIngredients = [...scannedIngredients]
                        newIngredients[index].price = Number.parseFloat(
                          e.target.value,
                        )
                        setScannedIngredients(newIngredients)
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`product-select-${index}`}>
                      Add to Product
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedProducts[ingredient.ingId]}
                        onValueChange={(value) =>
                          setSelectedProducts({
                            ...selectedProducts,
                            [ingredient.ingId]: value,
                          })
                        }
                        key={ingredient.ingId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(products.values()).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleAddIngredientToProduct(
                            ingredient.ingId,
                            selectedProducts[ingredient.ingId],
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {selectedIngredients.get(ingredient.ingId)?.length ? (
                    <div className="space-y-2">
                      <Label>Used in Products</Label>
                      <div className="space-y-1">
                        {selectedIngredients
                          .get(ingredient.ingId)
                          ?.map((product) => (
                            <div
                              key={`${product.pdId}-${ingredient.ingId}`}
                              className="flex items-center justify-between rounded-md border p-2"
                            >
                              <div className="flex items-center gap-2">
                                <span>{products.get(product.pdId)?.name}</span>
                                <Input
                                  type="number"
                                  value={product.quantity}
                                  disabled={!product.isEdit}
                                  onChange={(e) => {
                                    selectedIngredients
                                      .get(ingredient.ingId)
                                      ?.map((p) => {
                                        if (p.pdId === product.pdId) {
                                          p.quantity = Number.parseFloat(
                                            e.target.value,
                                          )
                                        }
                                      })
                                    setSelectedIngredients(
                                      new Map(selectedIngredients),
                                    )
                                  }}
                                  className="w-20"
                                  step={0.1}
                                  min={0}
                                />
                                <p className="text-muted-foreground text-sm">
                                  ({ingredient.unit})
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!product.isEdit ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      selectedIngredients
                                        .get(ingredient.ingId)
                                        ?.map((p) => {
                                          if (p.pdId === product.pdId) {
                                            p.isEdit = !p.isEdit
                                          }
                                        })
                                      setSelectedIngredients(
                                        new Map(selectedIngredients),
                                      )
                                    }}
                                  >
                                    {product.isEdit ? "Save" : "Edit"}
                                  </Button>
                                ) : (
                                  <></>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedIngredients((prev) => {
                                      const newMap = new Map(prev)
                                      const filteredList = newMap
                                        .get(ingredient.ingId)
                                        ?.filter((p) => p.pdId !== product.pdId)

                                      if (filteredList?.length) {
                                        newMap.set(
                                          ingredient.ingId,
                                          filteredList,
                                        )
                                      } else {
                                        newMap.set(ingredient.ingId, [])
                                      }

                                      return newMap
                                    })
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <></>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button className="w-full" onClick={handleSaveIngredients}>
            Save Ingredients
          </Button>
        </div>
      )}
    </div>
  )
}
