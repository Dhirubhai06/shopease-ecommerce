import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PAYMENT_LABELS = {
    cod: "Cash on delivery",
    upi: "UPI",
    card: "Credit/debit card",
};

function Orders() {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const { token } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE_URL}/api/orders/`, {
            headers: { Authorization: `Token ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Unable to load orders");
                return res.json();
            })
            .then((data) => setOrders(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [BASE_URL, token]);

    const getImageUrl = (image) => {
        if (!image) return "https://placehold.co/100x100?text=No+Image";
        if (image.startsWith("http")) return image;
        return `${BASE_URL.replace(/\/+$/, "")}${image.startsWith("/") ? image : `/${image}`}`;
    };

    if (!token) return <Navigate to="/login" />;
    if (loading) return <p className="text-center mt-10">Loading...</p>;
    if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-5">
            <h1 className="text-2xl font-bold text-gray-800">My Orders</h1>

            {orders.length === 0 && (
                <div className="text-center text-gray-600">
                    <p className="mb-4">No orders yet.</p>
                    <Link to="/" className="bg-blue-600 text-white px-5 py-2 rounded-lg">Start Shopping</Link>
                </div>
            )}

            {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-md p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-semibold text-lg text-gray-800">Order #{order.id}</h2>
                            <p className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-gray-800">₹{Number(order.total_amount).toFixed(2)}</p>
                            <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 capitalize">
                                {order.status}
                            </span>
                            {order.is_paid && (
                                <span className="ml-2 inline-block text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                    Paid
                                </span>
                            )}
                        </div>
                    </div>

                    <ul className="mt-4 divide-y">
                        {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-4 py-3">
                                <img
                                    src={getImageUrl(item.product?.image)}
                                    alt={item.product?.name}
                                    className="w-16 h-16 object-cover rounded-lg"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-gray-800">{item.product?.name}</p>
                                    <p className="text-sm text-gray-500">
                                        Qty: {item.quantity} × ₹{Number(item.price).toFixed(2)}
                                    </p>
                                </div>
                                <p className="font-medium text-gray-800">
                                    ₹{(Number(item.price) * item.quantity).toFixed(2)}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4 pt-4 border-t text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Address:</span> {order.shipping_address}</p>
                        <p><span className="font-medium">Phone:</span> {order.phone}</p>
                        <p><span className="font-medium">Payment:</span> {PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default Orders;