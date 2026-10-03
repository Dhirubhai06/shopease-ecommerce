import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import ProductCard from "../components/ProductCard";

function Wishlist() {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const { token } = useAuth();
    const { isWishlisted } = useWishlist();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE_URL}/api/wishlist/`, {
            headers: { Authorization: `Token ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setProducts(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [BASE_URL, token]);

    if (!token) return <Navigate to="/login" />;
    if (loading) return <p className="text-center mt-10">Loading...</p>;

    // heart hatane par card turant gayab ho jaye
    const visible = products.filter((p) => isWishlisted(p.id));

    return (
        <div className="max-w-5xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">My Wishlist</h1>

            {visible.length === 0 ? (
                <div className="text-center text-gray-600">
                    <p className="mb-4">Your wishlist is empty.</p>
                    <Link to="/" className="bg-blue-600 text-white px-5 py-2 rounded-lg">
                        Browse Products
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visible.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Wishlist;