// ==========================================
// TIPOS PARA EL CATÁLOGO DE PRODUCTOS
// ==========================================

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  retail_price: number;
  distributor_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Relaciones
  category?: Category;
  images?: ProductImage[];
  inventory?: Inventory;
}

export interface ProductImage {
  id: number;
  product_id: number;
  url: string;
  is_primary: boolean;
}

export interface Inventory {
  product_id: number;
  stock: number;
  low_stock_threshold: number;
}

// ==========================================
// REQUEST/RESPONSE TYPES
// ==========================================

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  category_id?: number;
  retail_price: number;
  distributor_price: number;
  active?: boolean;
  initial_stock?: number;
  low_stock_threshold?: number;
}

export interface UpdateProductRequest {
  sku?: string;
  name?: string;
  description?: string;
  category_id?: number;
  retail_price?: number;
  distributor_price?: number;
  active?: boolean;
}

export interface ProductListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    category_id?: number;
    search?: string;
    active?: boolean;
  };
}

export interface ProductDetailResponse {
  product: Product;
}

// ==========================================
// QUERY PARAMETERS
// ==========================================

export interface ProductQueryParams {
  page?: string;
  limit?: string;
  category_id?: string;
  search?: string;
  active?: string;
  sort?: 'name' | 'price' | 'created_at';
  order?: 'asc' | 'desc';
}

// ==========================================
// IMAGE UPLOAD TYPES
// ==========================================

export interface ImageUploadRequest {
  filename: string;
  contentType: string;
  is_primary?: boolean;
}

export interface ImageUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  filename: string;
  expiresIn: number;
}

export interface AddImageRequest {
  publicUrl: string;
  is_primary?: boolean;
}

// ==========================================
// INVENTORY TYPES
// ==========================================

export interface UpdateInventoryRequest {
  stock: number;
  low_stock_threshold?: number;
}

export interface InventoryUpdateResponse {
  inventory: Inventory;
  product: {
    id: number;
    name: string;
    sku: string;
  };
}

// ==========================================
// LOW STOCK TYPES
// ==========================================

export interface LowStockProduct {
  product_id: number;
  stock: number;
  low_stock_threshold: number;
  product: Product;
}

export interface LowStockResponse {
  lowStockProducts: LowStockProduct[];
  count: number;
}

// ==========================================
// CATEGORY TYPES
// ==========================================

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name: string;
}

export interface CategoryListResponse {
  categories: Category[];
}
