"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getProductById } from "@/data/products"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { useFavorites } from "@/hooks/use-favorites"
import { useCart, type CartItemCustomization } from "@/context/cart-context"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { OrderFooter } from "@/components/order-footer"

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { toggleFavorite, isFavorite } = useFavorites()
  const { addItem } = useCart()
  const [customMessage, setCustomMessage] = useState("")
  const [customizations, setCustomizations] = useState<Record<string, string | string[]>>({})
  const [totalPrice, setTotalPrice] = useState(0)

  // Estado para controlar a quantidade de recheios selecionados
  const [selectedFillings, setSelectedFillings] = useState({
    simple: [] as string[],
    gourmet: [] as string[],
  })

  const productId = params.id as string
  const product = getProductById(productId)

  // Determinar o número total de camadas de recheio permitidas
  const fillingLayers = useMemo(() => {
    if (!product?.customizationOptions) return 1

    const fillingLayersOption = product.customizationOptions.find((opt) => opt.type === "fillingLayers")
    if (!fillingLayersOption) return 1

    const selectedLayerId = customizations["fillingLayers"] as string
    if (!selectedLayerId) return 1

    const selectedLayer = fillingLayersOption.options.find((opt) => opt.id === selectedLayerId)
    if (!selectedLayer) return 1

    // Extrair o número da string "X Camadas"
    return selectedLayerId === "one" ? 1 : 2
  }, [product, customizations])

  // Total de recheios selecionados
  const totalSelectedFillings = useMemo(() => {
    return selectedFillings.simple.length + selectedFillings.gourmet.length
  }, [selectedFillings])

  // Recheios restantes que podem ser selecionados
  const remainingFillings = useMemo(() => {
    return Math.max(0, fillingLayers - totalSelectedFillings)
  }, [fillingLayers, totalSelectedFillings])

  // Verificar se todas as opções obrigatórias foram selecionadas
  const isFormValid = useMemo(() => {
    if (!product?.customizationOptions) return true

    // Verificar se todos os recheios foram selecionados
    if (totalSelectedFillings < fillingLayers) return false

    // Verificar outras opções obrigatórias
    const missingRequired = product.customizationOptions.filter((option) => {
      if (option.type === "simpleFilling" || option.type === "gourmetFilling") {
        // Verificar se pelo menos um recheio foi selecionado
        return totalSelectedFillings === 0
      }

      return (
        option.required &&
        (!customizations[option.type] ||
          (Array.isArray(customizations[option.type]) && (customizations[option.type] as string[]).length === 0))
      )
    })

    return missingRequired.length === 0
  }, [product, customizations, totalSelectedFillings, fillingLayers])

  useEffect(() => {
    if (product) {
      if (product.customizationOptions) {
        const initialSelections: Record<string, string | string[]> = {}

        product.customizationOptions.forEach((option) => {
          if (
            option.required &&
            !option.multiple &&
            option.type !== "simpleFilling" &&
            option.type !== "gourmetFilling"
          ) {
            initialSelections[option.type] = option.options[0].id
          } else if (option.multiple && option.type !== "simpleFilling" && option.type !== "gourmetFilling") {
            initialSelections[option.type] = []
          }
        })

        setCustomizations(initialSelections)
      }
    }
  }, [product])

  // Efeito para atualizar o preço quando as seleções mudarem
  useEffect(() => {
    if (!product) return

    let basePrice = 0
    let additionalPrice = 0

    // Determinar o preço base a partir do tamanho selecionado
    if (product.customizationOptions) {
      // Verificar se existe opção de tamanho
      const sizeOption = product.customizationOptions.find((opt) => opt.type === "cakeSize")

      if (sizeOption) {
        // Se existe opção de tamanho, o preço base é determinado pelo tamanho selecionado
        const selectedSizeId = customizations["cakeSize"] as string
        if (selectedSizeId) {
          const selectedSize = sizeOption.options.find((opt) => opt.id === selectedSizeId)
          if (selectedSize) {
            basePrice = selectedSize.price
          }
        } else {
          // Se nenhum tamanho foi selecionado ainda, use o preço do primeiro tamanho
          basePrice = sizeOption.options[0].price
        }
      } else {
        // Se não existe opção de tamanho, use o preço base do produto
        basePrice = product.price
      }

      // Adicionar preço das outras customizações (exceto tamanho)
      product.customizationOptions.forEach((option) => {
        // Pulamos a opção de tamanho, pois já foi tratada acima
        if (option.type !== "cakeSize" && option.type !== "simpleFilling" && option.type !== "gourmetFilling") {
          if (option.multiple) {
            // Para opções múltiplas (checkboxes)
            const selectedValues = (customizations[option.type] as string[]) || []
            selectedValues.forEach((selectedId) => {
              const selectedOption = option.options.find((opt) => opt.id === selectedId)
              if (selectedOption) {
                additionalPrice += selectedOption.price
              }
            })
          } else {
            // Para opções únicas (radio buttons)
            const selectedId = customizations[option.type] as string
            if (selectedId) {
              const selectedOption = option.options.find((opt) => opt.id === selectedId)
              if (selectedOption) {
                additionalPrice += selectedOption.price
              }
            }
          }
        }
      })
    } else {
      // Se não há opções de customização, use o preço base do produto
      basePrice = product.price
    }

    // Adicionar preço dos recheios simples
    const simpleFillingOption = product.customizationOptions?.find((opt) => opt.type === "simpleFilling")
    if (simpleFillingOption) {
      selectedFillings.simple.forEach((fillingId) => {
        const filling = simpleFillingOption.options.find((opt) => opt.id === fillingId)
        if (filling) {
          additionalPrice += filling.price
        }
      })
    }

    // Adicionar preço dos recheios gourmet
    const gourmetFillingOption = product.customizationOptions?.find((opt) => opt.type === "gourmetFilling")
    if (gourmetFillingOption) {
      selectedFillings.gourmet.forEach((fillingId) => {
        const filling = gourmetFillingOption.options.find((opt) => opt.id === fillingId)
        if (filling) {
          additionalPrice += filling.price
        }
      })
    }

    setTotalPrice(basePrice + additionalPrice)
  }, [product, customizations, selectedFillings])

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
        <Button onClick={() => router.push("/")} variant="outline">
          Voltar para a loja
        </Button>
      </div>
    )
  }

  const handleCustomizationChange = (type: string, value: string | string[]) => {
    // Se for uma mudança nas camadas de recheio, resetamos as seleções de recheio
    if (type === "fillingLayers") {
      setSelectedFillings({
        simple: [],
        gourmet: [],
      })
    }

    const newCustomizations = { ...customizations, [type]: value }
    setCustomizations(newCustomizations)
  }

  const handleFillingSelection = (fillingType: "simple" | "gourmet", fillingId: string, isSelected: boolean) => {
    if (isSelected) {
      // Se estamos tentando adicionar um recheio
      if (totalSelectedFillings >= fillingLayers) {
        // Já atingimos o limite de recheios
        toast.error(`Você já selecionou ${fillingLayers} recheio(s)`, {
          description: "Remova um recheio antes de adicionar outro",
          duration: 3000,
        })
        return false
      }

      // Adicionar o recheio
      setSelectedFillings((prev) => ({
        ...prev,
        [fillingType]: [...prev[fillingType], fillingId],
      }))
      return true
    } else {
      // Remover o recheio
      setSelectedFillings((prev) => ({
        ...prev,
        [fillingType]: prev[fillingType].filter((id) => id !== fillingId),
      }))
      return true
    }
  }

  const handleAddToCart = () => {
    // Verificar se todas as opções obrigatórias foram selecionadas
    const missingRequired = product.customizationOptions?.filter((option) => {
      if (option.type === "simpleFilling" || option.type === "gourmetFilling") {
        // Verificar se pelo menos um recheio foi selecionado
        return totalSelectedFillings === 0
      }

      return (
        option.required &&
        (!customizations[option.type] ||
          (Array.isArray(customizations[option.type]) && (customizations[option.type] as string[]).length === 0))
      )
    })

    if (missingRequired && missingRequired.length > 0) {
      toast.error("Por favor, complete todas as opções obrigatórias", {
        description: `Faltam: ${missingRequired.map((opt) => opt.label).join(", ")}`,
        duration: 3000,
      })
      return
    }

    // Verificar se todos os recheios foram selecionados
    if (totalSelectedFillings < fillingLayers) {
      toast.error(`Por favor, selecione ${fillingLayers} recheio(s)`, {
        description: `Você selecionou ${totalSelectedFillings} de ${fillingLayers} recheios`,
        duration: 3000,
      })
      return
    }

    // Preparar as customizações para adicionar ao carrinho
    const cartCustomizations: CartItemCustomization[] = []

    // Adicionar customizações regulares
    if (product.customizationOptions) {
      product.customizationOptions.forEach((option) => {
        if (option.type !== "simpleFilling" && option.type !== "gourmetFilling") {
          if (option.multiple) {
            // Para opções múltiplas (checkboxes)
            const selectedValues = (customizations[option.type] as string[]) || []
            selectedValues.forEach((selectedId) => {
              const selectedOption = option.options.find((opt) => opt.id === selectedId)
              if (selectedOption) {
                cartCustomizations.push({
                  type: option.type,
                  label: option.label,
                  value: selectedOption.name,
                  price: selectedOption.price,
                })
              }
            })
          } else {
            // Para opções únicas (radio buttons)
            const selectedId = customizations[option.type] as string
            if (selectedId) {
              const selectedOption = option.options.find((opt) => opt.id === selectedId)
              if (selectedOption) {
                cartCustomizations.push({
                  type: option.type,
                  label: option.label,
                  value: selectedOption.name,
                  price: selectedOption.price,
                })
              }
            }
          }
        }
      })
    }

    // Adicionar recheios simples
    const simpleFillingOption = product.customizationOptions?.find((opt) => opt.type === "simpleFilling")
    if (simpleFillingOption && selectedFillings.simple.length > 0) {
      selectedFillings.simple.forEach((fillingId) => {
        const filling = simpleFillingOption.options.find((opt) => opt.id === fillingId)
        if (filling) {
          cartCustomizations.push({
            type: "simpleFilling",
            label: simpleFillingOption.label,
            value: filling.name,
            price: filling.price,
          })
        }
      })
    }

    // Adicionar recheios gourmet
    const gourmetFillingOption = product.customizationOptions?.find((opt) => opt.type === "gourmetFilling")
    if (gourmetFillingOption && selectedFillings.gourmet.length > 0) {
      selectedFillings.gourmet.forEach((fillingId) => {
        const filling = gourmetFillingOption.options.find((opt) => opt.id === fillingId)
        if (filling) {
          cartCustomizations.push({
            type: "gourmetFilling",
            label: gourmetFillingOption.label,
            value: filling.name,
            price: filling.price,
          })
        }
      })
    }

    // Adicionar o item ao carrinho
    addItem({
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      quantity: 1,
      customizations: cartCustomizations,
      customMessage: customMessage || undefined,
      totalPrice: totalPrice,
    })

    // Redirecionar para a página inicial
    router.push("/")
  }

  // Função para renderizar as opções de personalização
  const renderCustomizationOptions = () => {
    if (!product.customizationOptions) return null

    return product.customizationOptions.map((option) => {
      // Renderização especial para recheios
      if (option.type === "simpleFilling" || option.type === "gourmetFilling") {
        const isSimple = option.type === "simpleFilling"
        const fillingType = isSimple ? "simple" : "gourmet"
        const selectedIds = selectedFillings[fillingType]

        return (
          <div key={option.type} className="mb-0">
            <div className="bg-rose-400 text-white py-3 px-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium">{option.label}</h3>
                <p className="text-sm opacity-90">
                  {remainingFillings > 0
                    ? `Escolha até ${remainingFillings} opção(ões)`
                    : "Limite de recheios atingido"}
                </p>
              </div>
              <Badge variant="secondary" className="bg-white text-rose-500">
                {totalSelectedFillings} / {fillingLayers}
              </Badge>
            </div>

            <div className="bg-white w-full">
              <div className="w-full divide-y divide-gray-100">
                {option.options.map((item) => {
                  const isChecked = selectedIds.includes(item.id)

                  return (
                    <div key={item.id} className="flex items-center justify-between py-3 px-4 w-full">
                      <span className="font-medium text-gray-800">
                        {item.name}
                        {item.price > 0 && (
                          <span className="ml-2 text-sm text-rose-600">
                            +R$ {item.price.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </span>
                      <CustomCheckbox
                        id={`${option.type}-${item.id}`}
                        checked={isChecked}
                        disabled={!isChecked && remainingFillings === 0}
                        onCheckedChange={(checked) => {
                          const success = handleFillingSelection(fillingType, item.id, checked as boolean)
                          return success
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }

      // Renderização normal para outras opções
      return (
        <div key={option.type} className="mb-0">
          <div className="bg-rose-400 text-white py-3 px-4">
            <h3 className="font-medium">{option.label}</h3>
            {option.required && <p className="text-sm opacity-90">Escolha 1 opção</p>}
          </div>

          <div className="bg-white w-full">
            {!option.multiple ? (
              <RadioGroup
                value={(customizations[option.type] as string) || ""}
                onValueChange={(value) => handleCustomizationChange(option.type, value)}
                className="w-full divide-y divide-gray-100"
              >
                {option.options.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-4 w-full">
                    <label htmlFor={`${option.type}-${item.id}`} className="font-medium text-gray-800">
                      {item.name}
                      {item.price !== 0 && (
                        <span className={`ml-2 text-sm ${item.price > 0 ? "text-rose-600" : "text-green-600"}`}>
                          {item.price > 0
                            ? `+R$ ${item.price.toFixed(2).replace(".", ",")}`
                            : `-R$ ${Math.abs(item.price).toFixed(2).replace(".", ",")}`}
                        </span>
                      )}
                    </label>
                    <RadioGroupItem value={item.id} id={`${option.type}-${item.id}`} className="text-rose-500" />
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="w-full divide-y divide-gray-100">
                {option.options.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-4 w-full">
                    <span className="font-medium text-gray-800">
                      {item.name}
                      {item.price !== 0 && (
                        <span className={`ml-2 text-sm ${item.price > 0 ? "text-rose-600" : "text-green-600"}`}>
                          {item.price > 0
                            ? `+R$ ${item.price.toFixed(2).replace(".", ",")}`
                            : `-R$ ${Math.abs(item.price).toFixed(2).replace(".", ",")}`}
                        </span>
                      )}
                    </span>
                    <CustomCheckbox
                      id={`${option.type}-${item.id}`}
                      checked={((customizations[option.type] as string[]) || []).includes(item.id)}
                      onCheckedChange={(checked) => {
                        const currentSelections = (customizations[option.type] as string[]) || []
                        let newValues: string[]

                        if (checked) {
                          newValues = [...currentSelections, item.id]
                        } else {
                          newValues = currentSelections.filter((id) => id !== item.id)
                        }

                        handleCustomizationChange(option.type, newValues)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Imagem do produto */}
      <div className="relative h-80 w-full">
        <Image
          src={product.imageUrl || "/placeholder.svg?height=400&width=800"}
          alt={product.name}
          fill
          className="object-cover"
          priority
        />

        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-white/80"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Button>
      </div>

      {/* Informações do produto */}
      <div className="py-4 px-4 bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-rose-800">{product.name}</h1>
            <p className="text-gray-600 text-sm mt-1">{product.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`${isFavorite(product.id) ? "text-rose-500" : "text-gray-400"}`}
            onClick={() => toggleFavorite(product.id)}
          >
            <Heart className={`w-6 h-6 ${isFavorite(product.id) ? "fill-rose-500" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Opções de personalização */}
      <div className="w-full">
        {renderCustomizationOptions()}

        {/* Mensagem personalizada */}
        <div>
          <div className="bg-rose-400 text-white py-3 px-4">
            <h3 className="font-medium">Mensagem personalizada (Opcional)</h3>
          </div>
          <div className="bg-white py-3 px-4">
            <Textarea
              placeholder="Ex: Feliz Aniversário Maria!"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="resize-none border-gray-200 w-full"
            />
          </div>
        </div>
      </div>

      {/* Barra de rodapé com o total e botão de adicionar à sacola */}
      <OrderFooter totalPrice={totalPrice} onAddToCart={handleAddToCart} isDisabled={!isFormValid} />
    </div>
  )
}

// Componente CustomCheckbox para ter o mesmo estilo do RadioGroupItem
function CustomCheckbox({
  id,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => boolean | void
}) {
  return (
    <div
      className={`h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center ${
        checked ? "bg-rose-500 border-rose-500" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={(e) => {
        e.stopPropagation() // Impedir propagação do evento
        if (!disabled || checked) {
          onCheckedChange(!checked)
        }
      }}
    >
      {checked && <div className="h-2.5 w-2.5 rounded-full bg-white"></div>}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          e.stopPropagation() // Impedir propagação do evento
          if (!disabled || checked) {
            onCheckedChange(e.target.checked)
          }
        }}
        className="sr-only"
      />
    </div>
  )
}

