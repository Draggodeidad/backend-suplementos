// ==========================================
// SERVICIO DE PRICING Y REGLAS COMERCIALES
// ==========================================

import {
  PriceTier,
  PricingConfig,
  PricingCalculation,
  CartItemWithProduct,
} from '../types/cart';
import { logger } from '../utils/logger';

export class PricingService {
  // Configuración de reglas comerciales
  private static readonly CONFIG: PricingConfig = {
    DISTRIBUTOR_THRESHOLD: 5000, // $5,000 MXN para precio distribuidor
    MINIMUM_ORDER_ITEMS: 7, // Mínimo 7 artículos para checkout
  };

  /**
   * Calcular pricing en tiempo real para el carrito
   */
  static calculatePricing(items: CartItemWithProduct[]): PricingCalculation {
    try {
      // Calcular subtotal con precios retail
      const retailSubtotal = items.reduce((total, item) => {
        return total + item.product.retail_price * item.qty;
      }, 0);

      // Calcular subtotal con precios distribuidor
      const distributorSubtotal = items.reduce((total, item) => {
        return total + item.product.distributor_price * item.qty;
      }, 0);

      // Contar total de artículos (cantidad de productos, no líneas)
      const totalItems = items.reduce((count, item) => count + item.qty, 0);

      // Determinar si califica para precio distribuidor
      const qualifiesForDistributor =
        retailSubtotal >= this.CONFIG.DISTRIBUTOR_THRESHOLD;

      // Seleccionar tier y subtotal final
      const tier: PriceTier = qualifiesForDistributor
        ? 'distributor'
        : 'retail';
      const subtotal = qualifiesForDistributor
        ? distributorSubtotal
        : retailSubtotal;

      // Calcular ahorros si aplica
      const distributorSavings = qualifiesForDistributor
        ? retailSubtotal - distributorSubtotal
        : undefined;

      // Verificar si cumple cantidad mínima para checkout
      const meetsMinimum = totalItems >= this.CONFIG.MINIMUM_ORDER_ITEMS;

      const calculation: PricingCalculation = {
        subtotal: Number(subtotal.toFixed(2)),
        tier,
        items_count: totalItems,
        meets_minimum: meetsMinimum,
        distributor_savings: distributorSavings
          ? Number(distributorSavings.toFixed(2))
          : undefined,
      };

      logger.debug(
        {
          calculation,
          retailSubtotal: Number(retailSubtotal.toFixed(2)),
          distributorSubtotal: Number(distributorSubtotal.toFixed(2)),
        },
        'Pricing calculation completed'
      );

      return calculation;
    } catch (error: any) {
      logger.error(
        { error: error.message, itemsCount: items.length },
        'Error calculating pricing'
      );

      // En caso de error, devolver valores seguros con tier retail
      return {
        subtotal: 0,
        tier: 'retail',
        items_count: 0,
        meets_minimum: false,
      };
    }
  }

  /**
   * Obtener información de configuración de pricing
   */
  static getPricingConfig(): PricingConfig {
    return { ...this.CONFIG };
  }

  /**
   * Validar si un subtotal califica para precio distribuidor
   */
  static qualifiesForDistributorPricing(subtotal: number): boolean {
    return subtotal >= this.CONFIG.DISTRIBUTOR_THRESHOLD;
  }

  /**
   * Validar si un carrito cumple la cantidad mínima para checkout
   */
  static meetsMinimumItems(itemCount: number): boolean {
    return itemCount >= this.CONFIG.MINIMUM_ORDER_ITEMS;
  }

  /**
   * Calcular precio unitario según tier
   */
  static getUnitPrice(
    retailPrice: number,
    distributorPrice: number,
    tier: PriceTier
  ): number {
    return tier === 'distributor' ? distributorPrice : retailPrice;
  }

  /**
   * Calcular total de una línea de carrito según tier
   */
  static calculateLineTotal(
    retailPrice: number,
    distributorPrice: number,
    qty: number,
    tier: PriceTier
  ): number {
    const unitPrice = this.getUnitPrice(retailPrice, distributorPrice, tier);
    return Number((unitPrice * qty).toFixed(2));
  }

  /**
   * Obtener resumen de ahorros para mostrar al usuario
   */
  static getSavingsSummary(items: CartItemWithProduct[]): {
    retail_total: number;
    distributor_total: number;
    potential_savings: number;
    qualifies_for_distributor: boolean;
  } {
    const retailTotal = items.reduce((total, item) => {
      return total + item.product.retail_price * item.qty;
    }, 0);

    const distributorTotal = items.reduce((total, item) => {
      return total + item.product.distributor_price * item.qty;
    }, 0);

    const potentialSavings = retailTotal - distributorTotal;
    const qualifiesForDistributor =
      this.qualifiesForDistributorPricing(retailTotal);

    return {
      retail_total: Number(retailTotal.toFixed(2)),
      distributor_total: Number(distributorTotal.toFixed(2)),
      potential_savings: Number(potentialSavings.toFixed(2)),
      qualifies_for_distributor: qualifiesForDistributor,
    };
  }
}
