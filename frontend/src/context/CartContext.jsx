import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "ecommerce_cart";

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try {
            const savedCart = localStorage.getItem(CART_STORAGE_KEY);
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (error) {
            console.error("Unable to parse cart from localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addToCart = (product) => {
        setItems((currentItems) => {
            const existingItem = currentItems.find((item) => item.id === product.id);

            if (existingItem) {
                return currentItems.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            return [...currentItems, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, change) => {
        setItems((currentItems) =>
            currentItems.flatMap((item) => {
                if (item.id !== productId) {
                    return [item];
                }

                const nextQuantity = item.quantity + change;
                return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
            })
        );
    };

    const removeFromCart = (productId) => {
        setItems((currentItems) =>
            currentItems.filter((item) => item.id !== productId)
        );
    };

    const clearCart = () => setItems([]);

    const itemCount = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity, 0),
        [items]
    );

    const total = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + Number(item.price) * item.quantity,
                0
            ),
        [items]
    );

    const value = useMemo(
        () => ({
            items,
            addToCart,
            updateQuantity,
            removeFromCart,
            clearCart,
            itemCount,
            total,
        }),
        [items, itemCount, total]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);

    if (!context) {
        throw new Error("useCart must be used within a CartProvider");
    }

    return context;
}
