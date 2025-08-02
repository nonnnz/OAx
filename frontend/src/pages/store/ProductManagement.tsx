/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import {
  Package,
  MoreVertical,
  Plus,
  Pencil,
  Trash,
  Loader2,
  Beef,
  ArrowLeft,
  SquareArrowOutUpRight,
  ReceiptText,
  CircleX,
} from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "../../components/ui/button"
import { Card, CardContent } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { MenuSelector } from "../../components/MenuSelector"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  getStoreProducts,
  createStoreProduct,
  updateStoreProduct,
  deleteStoreProduct,
  getStoreIngredients,
  updateStoreIngredient,
  createStoreReceipt,
  deleteStoreReceipt,
  updateStoreReceipt,
  deleteStoreIngredient,
} from "@/api/store"
import {
  Product,
  IngredientInfo,
  Ingredient,
  ReceiptInfo,
  // Receipt,
  CreateReceipt,
  ReceiptIngredient,
} from "@/types"
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectLabel,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { compressImage } from "@/lib/compressImg"
import { DialogTrigger } from "@radix-ui/react-dialog"
import { Label } from "@/components/ui/label"

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

// Zod schemas
const ingredientSchema = z.object({
  name: z.string(),
  unit: z.string(),
})

const ingredientInfoSchema = z.object({
  ingredientId: z.string(),
  ingredientName: z.string(),
  ingredientQuantity: z.number(),
  ingredientUnit: z.string(),
})

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  ingredientInfo: z.array(ingredientInfoSchema).optional(),
  ingredient: z.array(ingredientSchema).optional(),
  image: z.any().optional(),
  isActive: z.boolean().optional(),
})

const productUpdateSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  ingredientInfo: z.array(ingredientInfoSchema).optional(),
  ingredient: z.array(ingredientSchema).optional(),
  image: z.any().optional(),
  isActive: z.boolean().optional(),
})

const menuOptions = [
  { id: "products", label: "Products", icon: Package },
  { id: "ingredients", label: "Ingredients", icon: Beef },
]

export default function ProductManagement() {
  const { storeId } = useParams<{ storeId: string }>()
  const [activeMenu, setActiveMenu] = useState("products")
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(
    null,
  )
  const [isEditingIngredient, setIsEditingIngredient] = useState(false)
  // const [showReceipts, setShowReceipts] = useState<string | null>(null)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [receiptDialogEditOpen, setReceiptDialogEditOpen] = useState<
    Record<number, boolean>
  >({})
  // const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null)
  const [deleteReceiptDialogOpen, setDeleteReceiptDialogOpen] = useState<
    Record<number, boolean>
  >({})
  const [receiptForm, setReceiptForm] = useState<CreateReceipt>({
    store: "",
    receiptsRef: "",
    receiptsDate: new Date().toISOString().split("T")[0],
    ingredients: [
      {
        name: "",
        unit: "",
        quantity: 0,
        ingId: "",
        products: [],
        price: 0,
      },
    ],
  })

  // Forms
  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 1,
      ingredientInfo: [],
      ingredient: [],
      image: undefined,
      isActive: true,
    },
  })

  // Add ingredient update form
  const ingredientUpdateForm = useForm<z.infer<typeof ingredientSchema>>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: "",
      unit: "",
    },
  })

  // Fetch products and ingredients
  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return
      try {
        const [productsResponse, ingredientsResponse] = await Promise.all([
          getStoreProducts(storeId),
          getStoreIngredients(storeId),
        ])
        if (productsResponse.success) {
          // console.log(productsResponse)
          setProducts(productsResponse.data.products || [])
        }
        if (ingredientsResponse.success) {
          console.log(ingredientsResponse)
          setIngredients(ingredientsResponse.data.ingredients || [])
        }
      } catch {
        toast.error("Error fetching data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [storeId])

  const [file, setFile] = useState<File | null>(null)

  const handleAddProduct = async () => {
    if (!storeId) return
    try {
      const values = productSchema.parse(productForm.getValues())
      // console.log(values)
      values.ingredientInfo?.forEach((ingredient) => {
        if (ingredient.ingredientId.startsWith("mock-up-")) {
          values.ingredient?.push({
            name: ingredient.ingredientName,
            unit: ingredient.ingredientUnit,
          })
        }
      })
      console.log(values)
      // return
      const formData = new FormData()

      if (file) {
        formData.append("image", file) // Append the actual File object, not a string
      }

      // Append all form fields to FormData
      Object.entries(values).forEach(([key, value]) => {
        if (key === "image" && value) {
          // formData.append("image", value)
        } else if (key === "ingredientInfo" && value) {
          formData.append("ingredientInfo", JSON.stringify(value))
        } else if (key === "ingredient" && value) {
          formData.append("ingredient", JSON.stringify(value))
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString())
        }
      })

      for (const [key, value] of formData.entries()) {
        console.log(key, value)
      }
      // return

      const response = await createStoreProduct(storeId, formData)
      if (response.success) {
        setProducts([...products, response.data])
        toast.success("Product added successfully")
        setProductDialogOpen(false)
        setEditingProduct(null)
        productForm.reset()
        setFile(null)
        const ingredientsResponse = await getStoreIngredients(storeId)
        if (ingredientsResponse.success) {
          setIngredients(ingredientsResponse.data.ingredients || [])
        }
      } else {
        toast.error("Error adding product")
      }
    } catch (error) {
      console.log(error)
      toast.error("Error adding product")
    }
  }

  const handleEditProduct = async () => {
    if (!storeId || !editingProduct) return
    try {
      const values = productUpdateSchema.parse(productForm.getValues())
      if (!values.ingredient) {
        values.ingredient = []
      }

      values.ingredientInfo?.forEach((ingredient) => {
        if (ingredient.ingredientId.startsWith("mock-up-")) {
          values.ingredient?.push({
            name: ingredient.ingredientName,
            unit: ingredient.ingredientUnit,
          })
        }
      })

      const formData = new FormData()
      console.log(values)
      if (file) {
        const compressedFile = await compressImage(file, 2, 0.8)
        formData.append("image", compressedFile) // Append the actual File object, not a string
      }
      // Append all form fields to FormData
      Object.entries(values).forEach(([key, value]) => {
        // console.log(key, value)
        if (key === "image" && value) {
          //
        } else if (key === "ingredientInfo" && value) {
          formData.append("ingredientInfo", JSON.stringify(value))
        } else if (key === "ingredient" && value) {
          formData.append("ingredient", JSON.stringify(value))
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString())
        }
      })

      for (const [key, value] of formData.entries()) {
        console.log(key, value)
      }
      // return

      const response = await updateStoreProduct(
        storeId,
        editingProduct.id,
        formData,
      )
      // return
      if (response.success) {
        setProducts(
          products.map((p) => (p.id === editingProduct.id ? response.data : p)),
        )
        console.log(response.data)
        // setIngredients(
        //   ingredients.map((i) =>
        //     i.id === editingProduct.id ? response.data.ingredients : i,
        //   ),
        // )
        toast.success("Product updated successfully")
        setProductDialogOpen(false)
        setEditingProduct(null)
        productForm.reset({
          name: "",
          description: "",
          price: 1,
          ingredientInfo: [],
          ingredient: [],
          image: undefined,
        })
        setFile(null)
        const ingredientsResponse = await getStoreIngredients(storeId)
        if (ingredientsResponse.success) {
          setIngredients(ingredientsResponse.data.ingredients || [])
        }
      } else {
        toast.error("Error updating product")
      }
    } catch {
      toast.error("Error updating product")
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!storeId) return
    try {
      const response = await deleteStoreProduct(storeId, productId)
      if (response.success) {
        setProducts(products.filter((p) => p.id !== productId))
        toast.success("Product deleted successfully")
        setDeleteDialogOpen(false)
        setProductToDelete(null)
      } else {
        toast.error("Error deleting product")
      }
    } catch {
      toast.error("Error deleting product")
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newIngredientList, setNewIngredientList] = useState<IngredientInfo[]>(
    [],
  )

  const [isNewIngredientList, setIsNewIngredientList] = useState(false)

  const [tempIngredient, setTempIngredient] = useState({
    ingredientName: "",
    ingredientUnit: "",
  })

  const handleAddNewIngredient = (field: any) => {
    console.log("Temp Ingredient:", tempIngredient)
    const newIngredientTemp = {
      ingredientId: "mock-up-" + (newIngredientList.length + 1).toString(),
      ingredientName: tempIngredient.ingredientName,
      ingredientQuantity: 1,
      ingredientUnit: tempIngredient.ingredientUnit,
    }
    setNewIngredientList([...newIngredientList, newIngredientTemp])
    field.onChange([...(field.value || []), newIngredientTemp])
    console.log("Field Value:", newIngredientTemp)
    // Clear input fields after adding
    setTempIngredient({ ingredientName: "", ingredientUnit: "" })
    setIsNewIngredientList(false)
  }

  const handleRemoveNewIngredient = (field: any, index: number) => {
    const newIngredients = field.value?.filter(
      (_: any, i: number) => i !== index,
    )
    field.onChange(newIngredients)
  }

  const handleAddExistingIngredient = (
    field: any,
    selectedIngredient: Ingredient,
  ) => {
    console.log(field)
    if (
      field.value.find((i: any) => i.ingredientId === selectedIngredient.id)
    ) {
      toast.error("Ingredient already exists")
      return
    }
    const newIngredients = [...(field.value || [])]
    newIngredients.push({
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      ingredientQuantity: 1,
      ingredientUnit: selectedIngredient.unit,
    })
    field.onChange(newIngredients)
  }

  const handleUpdateIngredient = async () => {
    if (!storeId || !editingIngredient) return
    try {
      const values = ingredientUpdateForm.getValues()
      console.log(values, storeId, editingIngredient.id)
      // return
      const response = await updateStoreIngredient(
        storeId,
        editingIngredient.id,
        values,
      )
      if (response.success) {
        setIngredients(
          ingredients.map((i) =>
            i.id === editingIngredient.id ? response.data : i,
          ),
        )
        toast.success("Ingredient updated successfully")
        setIsEditingIngredient(false)
        setEditingIngredient(null)
        ingredientUpdateForm.reset()
      } else {
        toast.error("Error updating ingredient")
      }
    } catch {
      toast.error("Error updating ingredient")
    }
  }

  const handleDeleteIngredient = async (ingredientId: string) => {
    if (!storeId) return
    try {
      const response = await deleteStoreIngredient(storeId, ingredientId)
      if (response.success) {
        setIngredients(ingredients.filter((i) => i.id !== ingredientId))
        toast.success("Ingredient deleted successfully")
        setEditingIngredient(null)
      } else {
        toast.error("Error deleting ingredient")
      }
    } catch {
      toast.error("Error deleting ingredient")
    }
  }

  const handleCreateReceipt = async () => {
    if (!storeId) return
    try {
      console.log(receiptForm)
      // return
      const response = await createStoreReceipt(storeId, receiptForm)
      if (response.success) {
        toast.success("Receipt created successfully")
        setReceiptDialogOpen(false)
        setReceiptForm({
          store: "",
          receiptsRef: "",
          receiptsDate: new Date().toISOString().split("T")[0],
          ingredients: [
            {
              name: "",
              unit: "",
              quantity: 0,
              ingId: "",
              products: [],
              price: 0,
            },
          ],
        })
        // Refresh ingredients to show updated receipt info
        const ingredientsResponse = await getStoreIngredients(storeId)
        if (ingredientsResponse.success) {
          setIngredients(ingredientsResponse.data.ingredients || [])
          console.log(ingredientsResponse.data.ingredients)
          // if on edit get only the edited ingredient
          const editedIngredient = ingredientsResponse.data.ingredients.find(
            (i) => i.id === editingIngredient?.id,
          )
          if (editedIngredient) {
            setEditingIngredient(editedIngredient)
          }
        }
      } else {
        toast.error("Error creating receipt")
      }
    } catch {
      toast.error("Error creating receipt")
    }
  }

  const handleDeleteReceipt = async (index: number, receiptId: string) => {
    if (!storeId) return
    try {
      console.log(receiptId)
      // return
      const response = await deleteStoreReceipt(storeId, receiptId)
      if (response.success) {
        toast.success("Receipt deleted successfully")
        setDeleteReceiptDialogOpen((prev) => ({
          ...prev,
          [index]: false,
        }))
        // setReceiptToDelete(null)
        // Refresh ingredients to show updated receipt info
        const ingredientsResponse = await getStoreIngredients(storeId)
        if (ingredientsResponse.success) {
          setIngredients(ingredientsResponse.data.ingredients || [])
          setEditingIngredient(null)
          setReceiptDialogEditOpen((prev) => ({
            ...prev,
            [index]: false,
          }))
          setDeleteReceiptDialogOpen((prev) => ({
            ...prev,
            [index]: false,
          }))
        }
      } else {
        toast.error("Error deleting receipt", {
          description: response.message,
        })
      }
    } catch {
      toast.error("Error deleting receipt")
    }
  }

  const handleOpenReceiptDialogEdit = (index: number, isOpen: boolean) => {
    setReceiptDialogEditOpen((prev) => ({
      ...prev,
      [index]: isOpen,
    }))
    console.log(receiptDialogEditOpen)
  }

  const handleCloseReceiptDialogEdit = () => {
    setReceiptDialogEditOpen((prev) => {
      const newState = { ...prev }
      Object.keys(newState).forEach((key: string) => {
        newState[Number(key)] = false
      })
      return newState
    })
  }

  const handleCancelReceipt = async (receiptId: string) => {
    if (!storeId) return
    handleCloseReceiptDialogEdit()
    console.log("from handleCancelReceipt", receiptDialogEditOpen)
    // return
    // setReceiptDialogEditOpen(false)
    const updatedReceipt = await updateStoreReceipt(
      storeId,
      receiptId,
      {
        isActive: false,
      },
      editingIngredient?.id,
    )
    if (updatedReceipt.success) {
      toast.success("Receipt updated successfully")
      console.log(receiptDialogEditOpen)

      const ingredientsResponse = await getStoreIngredients(storeId)
      if (ingredientsResponse.success) {
        setIngredients(ingredientsResponse.data.ingredients || [])
      }
      const editedIngredient = ingredientsResponse.data.ingredients.find(
        (i) => i.id === editingIngredient?.id,
      )
      if (editedIngredient) {
        setEditingIngredient(editedIngredient)
      }
    } else {
      toast.error("Error updating receipt")
    }
  }

  // const handleAddReceiptIngredient = () => {
  //   setReceiptForm((prev) => ({
  //     ...prev,
  //     ingredients: [
  //       ...prev.ingredients,
  //       {
  //         name: "",
  //         unit: "",
  //         quantity: 0,
  //         ingId: "",
  //         products: [],
  //         price: 0,
  //       },
  //     ],
  //   }))
  // }

  const handleUpdateReceiptIngredient = (
    index: number,
    field: keyof ReceiptIngredient,
    value: any,
  ) => {
    setReceiptForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing,
      ),
    }))
  }

  // const handleRemoveReceiptIngredient = (index: number) => {
  //   setReceiptForm((prev) => ({
  //     ...prev,
  //     ingredients: prev.ingredients.filter((_, i) => i !== index),
  //   }))
  // }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Product Management</h1>

      {/* Menu Selector */}
      <MenuSelector
        options={menuOptions}
        value={activeMenu}
        onChange={setActiveMenu}
        className="mb-6"
      />

      {/* Products Management */}
      {activeMenu === "products" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingProduct(null)
                productForm.reset({
                  name: "",
                  description: "",
                  price: 1,
                  ingredientInfo: [],
                  ingredient: [],
                  image: undefined,
                })
                setFile(null)
                setProductDialogOpen(true)
                setIsNewIngredientList(false)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>

          {products
            .sort(
              (a, b) =>
                new Date(b.updatedAt || "").getTime() -
                new Date(a.updatedAt || "").getTime(),
            )
            .map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-1 h-auto w-auto flex-shrink-0">
                      <img
                        src={`${import.meta.env.VITE_API_URL}/public${product.imageUrl}?v=${new Date().getTime()}`}
                        alt={product.name}
                        className="aspect-square h-full w-full rounded-md object-cover dark:bg-white"
                      />
                    </div>
                    <div className="col-span-2 flex flex-1 flex-col justify-between gap-y-2 p-4">
                      {product.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                      <div>
                        <h3 className="text-2xl font-semibold">
                          {product.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {product.ingredientInfo?.length || 0} วัตถุดิบ
                        </p>
                        <p className="text-muted-foreground line-clamp-2 text-sm">
                          {product.description}
                        </p>
                      </div>
                      <div className="mt-2 font-semibold">฿{product.price}</div>
                    </div>
                    <div className="flex h-full justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingProduct(product)
                              productForm.reset(product)
                              setProductDialogOpen(true)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setProductToDelete(product)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          {/* Product Dialog */}
          <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add Product"}
                </DialogTitle>
              </DialogHeader>
              <Form {...productForm} key={"productForm"}>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (editingProduct) {
                      handleEditProduct()
                    } else {
                      handleAddProduct()
                    }
                  }}
                >
                  <FormField
                    control={productForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {editingProduct && (
                    <FormField
                      control={productForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>เปิดใช้งานสินค้า</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={productForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (฿)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter price"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={productForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter product description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={productForm.control}
                    name="ingredientInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <div className="flex w-full items-center justify-between">
                            Ingredients
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                !isNewIngredientList
                                  ? setIsNewIngredientList(true)
                                  : setIsNewIngredientList(false)
                              }
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {isNewIngredientList ? "Cancel" : "Add New"}
                            </Button>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            {isNewIngredientList ? (
                              <div className="flex gap-2">
                                <Input
                                  name="ingredientName"
                                  placeholder="Ingredient name"
                                  value={tempIngredient.ingredientName}
                                  onChange={(e) =>
                                    setTempIngredient({
                                      ...tempIngredient,
                                      ingredientName: e.target.value,
                                    })
                                  }
                                  required
                                />
                                {/* <Input
                                  name="ingredientUnit"
                                  placeholder="Unit"
                                  required
                                  value={tempIngredient.ingredientUnit}
                                  onChange={(e) =>
                                    setTempIngredient({
                                      ...tempIngredient,
                                      ingredientUnit: e.target.value,
                                    })
                                  }
                                /> */}

                                <Select
                                  value={tempIngredient.ingredientUnit}
                                  onValueChange={(e) => {
                                    setTempIngredient({
                                      ...tempIngredient,
                                      ingredientUnit: e,
                                    })
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.keys(STD_UNIT).map(
                                      (baseUnit: string) => (
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
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleAddNewIngredient(field)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <></>
                            )}
                            {/* Existing Ingredients */}
                            <Select
                              onValueChange={(value) => {
                                const selectedIngredient = ingredients.find(
                                  (i) => i.id === value,
                                )
                                if (selectedIngredient) {
                                  handleAddExistingIngredient(
                                    field,
                                    selectedIngredient,
                                  )
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an Existing Ingredient" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Ingredients</SelectLabel>
                                  {ingredients.map((ing) => (
                                    <SelectItem key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit})
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>

                            {field.value?.map((ingredient, index) => (
                              <div
                                key={index}
                                className="flex justify-between gap-4"
                              >
                                <div className="flex w-full items-center justify-end">
                                  <p>{ingredient.ingredientName}</p>
                                </div>
                                <div className="flex items-center justify-center gap-4">
                                  <Input
                                    value={ingredient.ingredientQuantity}
                                    placeholder="Quantity"
                                    type="number"
                                    min={1}
                                    step={0.1}
                                    onChange={(e) => {
                                      console.log(e.target.value)
                                      const newIngredients = [
                                        ...(field.value || []),
                                      ]
                                      newIngredients[index] = {
                                        ...ingredient,
                                        ingredientQuantity: Number(
                                          e.target.value,
                                        ),
                                      }
                                      field.onChange(newIngredients)
                                    }}
                                  />

                                  <p>{ingredient.ingredientUnit}</p>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={() =>
                                      handleRemoveNewIngredient(field, index)
                                    }
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={productForm.control}
                    name="image"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Product Image</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setFile(file)
                                onChange({
                                  type: "file",
                                  text: "BINARY",
                                  name: "image",
                                  size: file.size,
                                  fileName: file.name,
                                  mimeType: file.type,
                                })
                              }
                            }}
                            {...field}
                          />
                        </FormControl>
                        {file && (
                          <div className="mt-2">
                            <img
                              src={
                                typeof file === "string"
                                  ? file
                                  : URL.createObjectURL(new Blob([file]))
                              }
                              alt="Preview"
                              className="h-32 w-32 rounded-md object-cover"
                            />
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProductDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProduct ? "Update" : "Add"} Product
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Ingredients Management */}
      {activeMenu === "ingredients" && (
        <div className="space-y-4">
          {isEditingIngredient && editingIngredient ? (
            <Card className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditingIngredient(false)
                    setEditingIngredient(null)
                    ingredientUpdateForm.reset()
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-medium">Update Ingredient</h3>
              </div>
              <Form {...ingredientUpdateForm} key={"ingredientUpdateForm"}>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleUpdateIngredient()
                  }}
                >
                  <FormField
                    control={ingredientUpdateForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ingredient Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter ingredient name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={ingredientUpdateForm.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter unit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p>
                    <span className="font-medium">Quantity:</span>{" "}
                    {editingIngredient?.quantity || 0} {editingIngredient?.unit}
                  </p>

                  <div className="flex justify-end">
                    <Button type="submit">Update Ingredient</Button>
                  </div>
                </form>
              </Form>

              {/* Receipts section */}

              <div className="mt-4 flex flex-col gap-4 border-t pt-4">
                <div className="flex h-full items-center justify-between">
                  <h4 className="text-sm font-medium">Receipts</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReceiptForm({
                        store: "",
                        receiptsRef: "",
                        receiptsDate: new Date().toISOString().split("T")[0],
                        ingredients: [
                          {
                            name: editingIngredient?.name || "",
                            unit: editingIngredient?.unit || "",
                            quantity: 0,
                            ingId: editingIngredient?.id || "",
                            products: [],
                            price: 0,
                          },
                        ],
                      })
                      setReceiptDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Receipt
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingIngredient?.receiptInfo
                    ?.sort((_a, b) => (b.isActive ? 1 : -1))
                    .map((receipt: ReceiptInfo, index: number) => (
                      <div
                        key={receipt.receiptId}
                        className="flex items-center justify-between gap-2 px-4"
                      >
                        {receipt.isActive ? (
                          <div className="flex items-center gap-2">
                            <div className="bg-primary flex h-12 w-12 items-center justify-center rounded-md">
                              <ReceiptText className="text-primary-foreground h-6 w-6" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-sm">
                                ใช้ไปแล้ว: {receipt.quantityUsed}/
                                {receipt.quantity}
                                {editingIngredient?.unit}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                #บิล-{receipt.receiptId}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-md">
                              <ReceiptText className="text-muted-foreground h-6 w-6" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">ยกเลิกแล้ว</Badge>
                                <p className="text-sm">
                                  ใช้ไปแล้ว: {receipt.quantityUsed}/
                                  {receipt.quantity}
                                  {editingIngredient?.unit}
                                </p>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                #บิล-{receipt.receiptId}
                              </p>
                            </div>
                          </div>
                        )}
                        {/* {showReceipts[index] && ( */}
                        <Dialog
                          open={receiptDialogEditOpen[index]}
                          onOpenChange={(isOpen) => {
                            console.log(isOpen)
                            handleOpenReceiptDialogEdit(index, isOpen)
                          }}
                          key={receipt.receiptId}
                        >
                          <DialogTrigger asChild>
                            <div className="flex items-center justify-end">
                              <Button variant="outline" size="icon">
                                <SquareArrowOutUpRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Receipt</DialogTitle>
                              <DialogDescription>
                                #บิล-{receipt.receiptId}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              {editingIngredient?.receipts
                                ?.filter((rp) => rp.id === receipt.receiptId)
                                .map((rp) => (
                                  <div
                                    key={rp.id}
                                    className="flex flex-col gap-2"
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <p className="font-semibold">
                                        หมายเลขอ้างอิง: {rp.receiptsRef}
                                      </p>
                                      <p>ร้านค้า: {rp.store}</p>
                                      <p>
                                        วันที่:{" "}
                                        {new Date(
                                          rp.receiptsDate,
                                        ).toLocaleString("th-TH", {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                      <p>ราคา: {receipt.price} บาท</p>
                                      <p>
                                        จำนวน: {receipt.quantity}{" "}
                                        {editingIngredient?.unit}
                                      </p>
                                      <p>
                                        ใช้ไปแล้ว: {receipt.quantityUsed}
                                        {editingIngredient?.unit}
                                      </p>
                                      <p className="text-muted-foreground text-xs">
                                        (วันที่สร้าง:{" "}
                                        {new Date(
                                          rp.receiptsDate,
                                        ).toLocaleString("th-TH", {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        )
                                      </p>
                                      {receipt.isActive ? (
                                        <div>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                              handleCancelReceipt(rp.id)
                                            }}
                                          >
                                            ยกเลิกการใช้งาน
                                            <CircleX className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <></>
                                      )}
                                      <div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setDeleteReceiptDialogOpen(
                                              (prev) => ({
                                                ...prev,
                                                [index]: true,
                                              }),
                                            )
                                          }}
                                        >
                                          ลบออกจากร้านค้า
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    {rp.imageUrl !== "" ? (
                                      <img
                                        src={`${import.meta.env.VITE_API_URL}/public${rp.imageUrl}?v=${new Date().getTime()}`}
                                        alt="Receipt"
                                        className="mx-auto w-[80%] rounded-md object-cover"
                                      />
                                    ) : (
                                      <div className="bg-muted mx-auto flex h-24 w-24 items-center justify-center rounded-md">
                                        <p className="text-muted-foreground text-xs">
                                          ไม่มีรูปภาพ
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                        {/* Delete Receipt Dialog */}
                        <Dialog
                          open={deleteReceiptDialogOpen[index]}
                          onOpenChange={(isOpen) => {
                            console.log(isOpen)
                            handleOpenReceiptDialogEdit(index, isOpen)
                          }}
                        >
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Receipt</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete this receipt?
                                This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setDeleteReceiptDialogOpen((prev) => ({
                                    ...prev,
                                    [index]: false,
                                  }))
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() =>
                                  handleDeleteReceipt(index, receipt.receiptId)
                                }
                              >
                                Delete
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))}
                </div>
              </div>
              {/* Create Receipt Dialog */}
              <Dialog
                open={receiptDialogOpen}
                onOpenChange={setReceiptDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Receipt</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Receipt Reference</Label>
                      <Input
                        value={receiptForm.receiptsRef}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptsRef: e.target.value,
                          }))
                        }
                        placeholder="Enter receipt reference"
                      />
                      <p className="text-muted-foreground text-xs">
                        (อ้างอิงจากบิลที่มีอยู่)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>ร้านค้าที่ซื้อ</Label>
                      <Input
                        placeholder="ร้านค้าที่ซื้อ"
                        value={receiptForm.store}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            store: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>วันที่ซื้อ</Label>
                      <Input
                        type="date"
                        value={receiptForm.receiptsDate}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptsDate: e.target.value,
                          }))
                        }
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Ingredients</Label>
                        {/* <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddReceiptIngredient}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Ingredient
                        </Button> */}
                      </div>
                      <div className="space-y-2">
                        <div key={0} className="flex items-center gap-2">
                          <Label>Name</Label>
                          <Input
                            placeholder="Name"
                            value={editingIngredient?.name || ""}
                            disabled
                          />
                          <Label>Quantity</Label>
                          <Input
                            placeholder="Quantity"
                            type="number"
                            value={receiptForm.ingredients[0].quantity}
                            onChange={(e) =>
                              handleUpdateReceiptIngredient(
                                0,
                                "quantity",
                                Number(e.target.value),
                              )
                            }
                          />
                          <Label>Price (บาท)</Label>
                          <Input
                            placeholder="Price"
                            type="number"
                            value={receiptForm.ingredients[0].price}
                            onChange={(e) =>
                              handleUpdateReceiptIngredient(
                                0,
                                "price",
                                Number(e.target.value),
                              )
                            }
                          />
                          {/* <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveReceiptIngredient(0)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button> */}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReceiptDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateReceipt}>
                        Create Receipt
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          ) : (
            ingredients.map((ing: Ingredient) => (
              <Card key={ing.id}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold">{ing.name}</h3>
                      <p className="text-muted-foreground text-sm">
                        คงเหลือ {ing.quantity || 0} {ing.unit}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex items-start justify-end"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setIsEditingIngredient(true)
                            setEditingIngredient(ing)
                            ingredientUpdateForm.reset({
                              name: ing.name,
                              unit: ing.unit,
                            })
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Update
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            handleDeleteIngredient(ing.id)
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setProductToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                productToDelete && handleDeleteProduct(productToDelete.id)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
