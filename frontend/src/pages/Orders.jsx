import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const STEPS = [
    { key: "pending", label: "Placed" },
    { key: "shipped", label: "Shipped" },
    { key: "delivered", label: "Delivered" },
];

function OrderTimeline({ status }) {
    if (status === "cancelled") {
        return (
            <p className="mt-4 text-sm text-red-600 font-medium">
                This order was cancelled.
            </p>
        );
    }

    // status list me na mile to pehla step maan lo
    const currentIndex = Math.max(
        0,
        STEPS.findIndex((step) => step.key === status)
    );

    return (
        <div className="flex items-center mt-5">
            {STEPS.map((step, i) => {
                const done = i <= currentIndex;
                return (
                    <div
                        key={step.key}
                        className="flex items-center flex-1 last:flex-none"
                    >
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-200 text-gray-500"
                                    }`}
                            >
                                {done ? "✓" : i + 1}
                            </div>
                            <span
                                className={`mt-1 text-xs ${done ? "text-green-700 font-medium" : "text-gray-500"
                                    }`}
                            >
                                {step.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={`flex-1 h-1 mx-2 mb-5 rounded ${i < currentIndex ? "bg-green-600" : "bg-gray-200"
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
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
    const [cancellingId, setCancellingId] = useState(null);
    const [actionError, setActionError] = useState("");
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
    const downloadInvoice = async (orderId) => {
        try {
            const response = await fetch(`${BASE_URL}/api/orders/${orderId}/invoice/`, {
                headers: { Authorization: `Token ${token}` },
            });
            if (!response.ok) {
                alert("Unable to download invoice");
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `invoice-${orderId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Something went wrong. Try again.");
        }
    };
    const getImageUrl = (image) => {
        if (!image) return "https://placehold.co/100x100?text=No+Image";
        if (image.startsWith("http")) return image;
        return `${BASE_URL.replace(/\/+$/, "")}${image.startsWith("/") ? image : `/${image}`}`;
    };
    const handleCancel = async (orderId) => {
        if (!window.confirm(`Cancel order #${orderId}?`)) return;
        setActionError("");
        setCancellingId(orderId);
        try {
            const res = await fetch(`${BASE_URL}/api/orders/${orderId}/cancel/`, {
                method: "POST",
                headers: { Authorization: `Token ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "Unable to cancel order");
            setOrders((prev) => prev.map((o) => (o.id === orderId ? data : o)));
        } catch (err) {
            setActionError(err.message);
        } finally {
            setCancellingId(null);
        }
    };
    if (!token) return <Navigate to="/login" />;
    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-5">
                {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton h-44 w-full" />
                ))}
            </div>
        );
    }
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

            {actionError && <p className="text-red-500 text-sm">{actionError}</p>}

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
                            <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full capitalize ${order.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                                }`}>
                                {order.status}
                            </span>
                            {order.is_paid && (
                                <span className="ml-2 inline-block text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                    Paid
                                </span>
                            )}
                        </div>
                    </div>
                    <OrderTimeline status={order.status} />
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
                        <button
                            onClick={() => downloadInvoice(order.id)}
                            className="mt-3 mr-4 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                        >
                            Download Invoice
                        </button>
                        {order.status === "pending" && !order.is_paid && (
                            <button
                                onClick={() => handleCancel(order.id)}
                                disabled={cancellingId === order.id}
                                className="mt-3 text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                            >
                                {cancellingId === order.id ? "Cancelling..." : "Cancel order"}
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default Orders;