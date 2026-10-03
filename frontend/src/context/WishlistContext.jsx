import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const { token } = useAuth();
    const [ids, setIds] = useState([]);

    useEffect(() => {
        if (!token) {
            setIds([]);
            return;
        }
        fetch(`${BASE_URL}/api/wishlist/`, {
            headers: { Authorization: `Token ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setIds(Array.isArray(data) ? data.map((p) => p.id) : []));
    }, [BASE_URL, token]);

    const toggleWishlist = async (productId) => {
        const response = await fetch(`${BASE_URL}/api/wishlist/toggle/${productId}/`, {
            method: "POST",
            headers: { Authorization: `Token ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
            setIds((prev) =>
                data.wishlisted ? [...prev, productId] : prev.filter((id) => id !== productId)
            );
        }
    };

    const isWishlisted = (productId) => ids.includes(productId);

    return (
        <WishlistContext.Provider value={{ ids, toggleWishlist, isWishlisted }}>
            {children}
        </WishlistContext.Provider>
    );
}

export const useWishlist = () => useContext(WishlistContext);