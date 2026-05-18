'use client';

import { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { calculateSubtotalCents, calculateTaxCents, calculateTotalCents } from '../../lib/cart-calculations';

export interface CartCustomization {
  name: string;
  priceCents: number;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  customizations: CartCustomization[];
  notes: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { menuItemId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { menuItemId: string; quantity: number } }
  | { type: 'UPDATE_CUSTOMIZATIONS'; payload: { menuItemId: string; customizations: CartCustomization[] } }
  | { type: 'UPDATE_NOTES'; payload: { menuItemId: string; notes: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'HYDRATE'; payload: CartState };

const initialState: CartState = {
  items: [],
  isOpen: false
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingIndex = state.items.findIndex(
        item => item.menuItemId === action.payload.menuItemId
      );
      
      if (existingIndex >= 0) {
        const newItems = [...state.items];
        const existingItem = newItems[existingIndex];
        if (existingItem) {
          newItems[existingIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + action.payload.quantity
          };
        }
        return { ...state, items: newItems, isOpen: true };
      }
      
      return { ...state, items: [...state.items, action.payload], isOpen: true };
    }
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.menuItemId !== action.payload.menuItemId)
      };
    
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item.menuItemId !== action.payload.menuItemId)
        };
      }
      
      return {
        ...state,
        items: state.items.map(item =>
          item.menuItemId === action.payload.menuItemId
            ? { ...item, quantity: action.payload.quantity }
            : item
        )
      };
    }
    
    case 'UPDATE_CUSTOMIZATIONS':
      return {
        ...state,
        items: state.items.map(item =>
          item.menuItemId === action.payload.menuItemId
            ? { ...item, customizations: action.payload.customizations }
            : item
        )
      };
    
    case 'UPDATE_NOTES':
      return {
        ...state,
        items: state.items.map(item =>
          item.menuItemId === action.payload.menuItemId
            ? { ...item, notes: action.payload.notes }
            : item
        )
      };
    
    case 'CLEAR_CART':
      return { ...state, items: [] };
    
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };
    
    case 'OPEN_CART':
      return { ...state, isOpen: true };
    
    case 'CLOSE_CART':
      return { ...state, isOpen: false };
    
    case 'HYDRATE':
      return action.payload;
    
    default:
      return state;
  }
}

interface CartContextValue {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  isHydrated: boolean;
  subtotalCents: number;
  estimatedTaxCents: number;
  estimatedTotalCents: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bbq-cart');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        dispatch({ type: 'HYDRATE', payload: { items: parsed.items || [], isOpen: false } });
      } catch {
        // Invalid stored data, ignore
      }
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    localStorage.setItem('bbq-cart', JSON.stringify({ items: state.items }));
  }, [state.items]);

  // Calculate totals
  const subtotalCents = calculateSubtotalCents(state.items);
  const estimatedTaxCents = calculateTaxCents(subtotalCents);
  const estimatedTotalCents = calculateTotalCents(subtotalCents, estimatedTaxCents);
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        state,
        dispatch,
        isHydrated,
        subtotalCents,
        estimatedTaxCents,
        estimatedTotalCents,
        itemCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
