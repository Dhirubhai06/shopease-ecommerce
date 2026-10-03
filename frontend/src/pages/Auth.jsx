import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Auth({ mode }) {
    const isLogin = mode === "login";
    const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL;
    const navigate = useNavigate();
    const { loginUser } = useAuth();
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await fetch(`${BASEURL}/api/${isLogin ? "login" : "register"}/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || JSON.stringify(data));
                return;
            }
            loginUser(data.token, data.username);
            navigate("/");
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-16 p-6 bg-white rounded-xl shadow-md space-y-4">
            <h1 className="text-2xl font-bold">{isLogin ? "Login" : "Create account"}</h1>
            <input name="username" value={form.username} onChange={handleChange}
                placeholder="Username" required className="w-full border rounded-lg p-2" />
            {!isLogin && (
                <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="Email" required className="w-full border rounded-lg p-2" />
            )}
            <input name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="Password" required className="w-full border rounded-lg p-2" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button disabled={loading} className="w-full bg-gray-900 text-white py-2 rounded-lg disabled:opacity-50">
                {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
            </button>
            <p className="text-sm text-center">
                {isLogin ? (
                    <>New here? <Link to="/register" className="text-blue-600">Register</Link></>
                ) : (
                    <>Already have an account? <Link to="/login" className="text-blue-600">Login</Link></>
                )}
            </p>
        </form>
    );
}

export default Auth;