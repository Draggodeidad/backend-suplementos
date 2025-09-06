// ==========================================
// TIPOS PARA CARRITO Y REGLAS COMERCIALES
// ==========================================

import { Product } from './catalog';

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  cart_id: string;
  product_id: number;
  qty: number;
  product?: Product; // Información del producto (join)
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
}

// ==========================================
// PRICING Y REGLAS COMERCIALES
// ==========================================

export type PriceTier = 'retail' | 'distributor';

export interface PricingConfig {
  DISTRIBUTOR_THRESHOLD: number; // Monto mínimo para precio distribuidor
  MINIMUM_ORDER_ITEMS: number; // Cantidad mínima de artículos
}

export interface PricingCalculation {
  subtotal: number;
  tier: PriceTier;
  items_count: number;
  meets_minimum: boolean;
  distributor_savings?: number; // Cuánto ahorra vs retail
}

export interface CartSummary {
  cart: Cart;
  items: CartItemWithProduct[];
  pricing: PricingCalculation;
  total_items: number;
}

// ==========================================
// REQUEST/RESPONSE TYPES
// ==========================================

export interface AddToCartRequest {
  product_id: number;
  qty: number;
}

export interface UpdateCartItemRequest {
  qty: number;
}

export interface AddToCartResponse {
  success: boolean;
  item: CartItemWithProduct;
  cart_summary: CartSummary;
}

export interface CartResponse {
  success: boolean;
  cart_summary: CartSummary;
}

export interface UpdateCartItemResponse {
  success: boolean;
  item?: CartItemWithProduct;
  cart_summary: CartSummary;
}

export interface RemoveFromCartResponse {
  success: boolean;
  cart_summary: CartSummary;
}

// ==========================================
// VALIDACIÓN Y ERRORES
// ==========================================

export interface CartValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface StockValidation {
  product_id: number;
  requested_qty: number;
  available_stock: number;
  is_valid: boolean;
}
