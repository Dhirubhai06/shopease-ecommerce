import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

function AddressManager() {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const { token } = useAuth();
    const [addresses, setAddresses] = useState([]);
    const [form, setForm] = useState({ label: "Home", address: "", phone: "" });
    const [error, setError] = useState("");

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
    };

    useEffect(() => {
        fetch(`${BASE_URL}/api/addresses/`, { headers })
            .then((res) => res.json())
            .then((data) => setAddresses(Array.isArray(data) ? data : []));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [BASE_URL, token]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleAdd = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const response = await fetch(`${BASE_URL}/api/addresses/`, {
                method: "POST",
                headers,
                body: JSON.stringify(form),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.phone?.[0] || data.address?.[0] || data.detail || "Unable to save address");
                return;
            }
            setAddresses([data, ...addresses]);
            setForm({ label: "Home", address: "", phone: "" });
        } catch {
            setError("Server error. Check the backend terminal for details.");
        }
    };

    const handleDelete = async (id) => {
        const response = await fetch(`${BASE_URL}/api/addresses/${id}/`, {
            method: "DELETE",
            headers,
        });
        if (response.ok) setAddresses(addresses.filter((a) => a.id !== id));
    };

    const inputClass = "mt-1 w-full rounded-md border border-gray-300 p-3";

    return (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">My addresses</h2>

            {addresses.length === 0 && (
                <p className="text-sm text-gray-500">No saved addresses yet.</p>
            )}

            <ul className="space-y-3">
                {addresses.map((a) => (
                    <li key={a.id} className="flex justify-between gap-4 border border-gray-300 rounded-lg p-3">
                        <div className="text-sm text-gray-700">
                            <p className="font-medium text-gray-800">{a.label}</p>
                            <p>{a.address}</p>
                            <p>Phone: {a.phone}</p>
                        </div>
                        <button
                            onClick={() => handleDelete(a.id)}
                            className="text-red-600 hover:text-red-700 text-sm h-fit"
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>

            <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t">
                <p className="font-medium text-gray-800">Add new address</p>
                <label className="block text-sm font-medium text-gray-700">
                    Label
                    <select name="label" value={form.label} onChange={handleChange} className={inputClass}>
                        <option>Home</option>
                        <option>Office</option>
                        <option>Other</option>
                    </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                    Address
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
                        className={inputClass}
                    />
                </label>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button className="bg-gray-900 text-white px-5 py-2 rounded-lg">Save address</button>
            </form>
        </div>
    );
}

export default AddressManager;