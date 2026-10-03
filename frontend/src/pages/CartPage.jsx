import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

function CartPage() {
    const { items, total, updateQuantity, removeFromCart, clearCart } = useCart();
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";

    const getProductImageUrl = (image) => {
        if (!image) return "https://placehold.co/200x200?text=No+Image";
        if (image.startsWith("http://") || image.startsWith("https://")) return image;
        const cleanBaseUrl = BASE_URL.replace(/\/+$/, "");
        const cleanImagePath = image.startsWith("/") ? image : `/${image}`;
        return `${cleanBaseUrl}${cleanImagePath}`;
    };

    if (!items.length) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Your Cart</h1>
                <p className="text-gray-600 mb-6">Your cart is empty right now.</p>
                <Link
                    to="/"
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                >
                    Continue Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Your Cart</h1>
                <button
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-700 font-medium"
                >
                    Clear Cart
                </button>
            </div>

            <div className="space-y-5">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white rounded-xl shadow-md p-4"
                    >
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <img
                                src={getProductImageUrl(item.image)}
                                alt={item.name}
                                className="w-24 h-24 object-cover rounded-lg"
                            />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">{item.name}</h2>
                                <p className="text-gray-600">₹{Number(item.price).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-xl"
                            >
                                -
                            </button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-xl"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <p className="font-semibold text-gray-800">
                                ₹{(Number(item.price) * item.quantity).toFixed(2)}
                            </p>
                            <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700 font-medium"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 bg-gray-50 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center text-xl font-bold text-gray-800">
                    <span>Total</span>
                    <span>₹{Number(total).toFixed(2)}</span>
                </div>
                <Link
                    to="/checkout"
                    className="mt-5 block w-full text-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
                >
                    Proceed to Checkout
                </Link>
            </div>
        </div>
    );
}

export default CartPage;