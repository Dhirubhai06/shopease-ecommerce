import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const loadRazorpay = () =>
    new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

function Checkout() {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const navigate = useNavigate();
    const { token } = useAuth();
    const { items, total, clearCart } = useCart();

    const [form, setForm] = useState({ address: "", phone: "", payment_method: "cod" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [orderId, setOrderId] = useState(null);               // payment/order complete
    const [pendingOrderId, setPendingOrderId] = useState(null); // order bana, payment baaki
    const [savedAddresses, setSavedAddresses] = useState([]);

    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
    };

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE_URL}/api/addresses/`, { headers: { Authorization: `Token ${token}` } })
            .then((res) => res.json())
            .then((data) => setSavedAddresses(Array.isArray(data) ? data : []));
    }, [BASE_URL, token]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSavedAddress = (e) => {
        const selected = savedAddresses.find((a) => String(a.id) === e.target.value);
        if (selected) setForm({ ...form, address: selected.address, phone: selected.phone });
    };

    const finishSuccess = (id) => {
        clearCart();
        setPendingOrderId(null);
        setOrderId(id);
    };

    const startPayment = async (id) => {
        const loaded = await loadRazorpay();
        if (!loaded) {
            setError("Could not load the payment window. Check your internet connection.");
            return;
        }

        const res = await fetch(`${BASE_URL}/api/payments/create/`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.detail || "Unable to start payment");

        const rzp = new window.Razorpay({
            key: data.key,
            amount: data.amount,
            currency: data.currency,
            name: "ShopEase",
            description: `Order #${id}`,
            order_id: data.razorpay_order_id,
            prefill: { contact: form.phone },
            theme: { color: "#16a34a" },
            handler: async (response) => {
                try {
                    const verify = await fetch(`${BASE_URL}/api/payments/verify/`, {
                        method: "POST",
                        headers: authHeaders,
                        body: JSON.stringify(response),
                    });
                    const result = await verify.json();
                    if (!verify.ok) throw new Error(result.error || "Payment verification failed");
                    finishSuccess(id);
                } catch (err) {
                    setError(err.message);
                }
            },
            modal: {
                ondismiss: () =>
                    setError("Payment not completed. Click Pay now to try again."),
            },
        });
        rzp.on("payment.failed", (resp) =>
            setError(resp.error?.description || "Payment failed. Please try again.")
        );
        rzp.open();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!token) {
            navigate("/login");
            return;
        }

        setLoading(true);
        try {
            let id = pendingOrderId;

            if (!id) {
                const response = await fetch(`${BASE_URL}/api/orders/create/`, {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({
                        ...form,
                        items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || data.detail || "Unable to place order");
                }
                id = data.id;

                if (form.payment_method === "cod") {
                    finishSuccess(id);
                    return;
                }
                setPendingOrderId(id);
            }

            await startPayment(id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (orderId) {
        return (
            <div className="max-w-md mx-auto mt-16 p-8 bg-green-50 rounded-xl text-center">
                <h2 className="text-2xl font-bold text-green-700 mb-2">Order placed successfully 🎉</h2>
                <p className="text-gray-700 mb-6">Your order ID is #{orderId}</p>
                <div className="flex justify-center gap-3">
                    <Link to="/orders" className="bg-gray-900 text-white px-5 py-2 rounded-lg">My Orders</Link>
                    <Link to="/" className="bg-blue-600 text-white px-5 py-2 rounded-lg">Continue Shopping</Link>
                </div>
            </div>
        );
    }

    if (!token) return <Navigate to="/login" />;
    if (!items.length) return <Navigate to="/cart" />;

    const inputClass = "mt-1 w-full rounded-md border border-gray-300 p-3";
    const online = form.payment_method !== "cod";

    let buttonText = "Place order";
    if (loading) buttonText = "Please wait...";
    else if (pendingOrderId) buttonText = "Pay now";
    else if (online) buttonText = "Place order & pay";

    return (
        <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-8">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <h1 className="text-2xl font-bold text-gray-800">Checkout</h1>

                <div className="rounded-lg border border-yellow-400 bg-yellow-100 text-yellow-800 text-sm p-3">
                    <strong>Demo store (Razorpay test mode).</strong> No real money is charged.
                    Test card: 4111 1111 1111 1111, any future expiry, any CVV. Test UPI: success@razorpay.
                </div>

                {pendingOrderId && (
                    <p className="text-sm text-gray-700">
                        Order #{pendingOrderId} is created. Complete the payment to confirm it.
                    </p>
                )}

                <fieldset disabled={!!pendingOrderId || loading} className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Use a saved address
                        <select
                            defaultValue=""
                            onChange={handleSavedAddress}
                            disabled={savedAddresses.length === 0}
                            className={`${inputClass} bg-white disabled:opacity-60`}
                        >
                            <option value="" disabled>
                                {savedAddresses.length ? "Choose saved address" : "No saved addresses yet"}
                            </option>
                            {savedAddresses.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.label}: {a.address.slice(0, 30)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Delivery address
                        <textarea
                            name="address"
                            value={form.address}
                            onChange={handleChange}
                            required
                            rows={3}
                            className={inputClass}
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Phone
                        <input
                            name="phone"
                            type="tel"
                            value={form.phone}
                            onChange={handleChange}
                            required
                            maxLength={10}
                            pattern="\d{10}"
                            title="Enter a 10 digit phone number"
                            className={inputClass}
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        Payment method
                        <select
                            name="payment_method"
                            value={form.payment_method}
                            onChange={handleChange}
                            className={`${inputClass} bg-white`}
                        >
                            <option value="cod">Cash on delivery</option>
                            <option value="upi">UPI</option>
                            <option value="card">Credit/debit card</option>
                        </select>
                    </label>
                </fieldset>

                {online && !pendingOrderId && (
                    <p className="text-xs text-gray-500">
                        A secure Razorpay window will open to take your payment.
                    </p>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                >
                    {buttonText}
                </button>
            </form>

            <div className="bg-gray-50 rounded-xl p-6 h-fit">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Order summary</h2>
                <ul className="space-y-2 text-gray-700">
                    {items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                            <span>{item.name} × {item.quantity}</span>
                            <span>₹{(Number(item.price) * item.quantity).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-between font-bold text-lg text-gray-800 border-t mt-4 pt-4">
                    <span>Total</span>
                    <span>₹{Number(total).toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}

export default Checkout;