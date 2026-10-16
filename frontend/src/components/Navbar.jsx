import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import ThemeToggle from "./ThemeToggle";

function Navbar() {
    const { token, username, logoutUser } = useAuth();
    const { items } = useCart();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <nav className="bg-slate-950/95 border-b border-slate-800 shadow-sm backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                <Link to="/" className="font-semibold text-lg tracking-tight text-white">ShopEase</Link>

                <div className="flex items-center gap-5">
                    <ThemeToggle />
                    {token ? (
                        <>
                            <Link to="/orders" className="label-mono text-slate-300 hover:text-white transition">My Orders</Link>
                            <Link to="/profile" className="label-mono text-slate-300 hover:text-white transition">Hi, {username}</Link>
                            <Link to="/wishlist" className="label-mono text-slate-300 hover:text-white transition">Wishlist</Link>
                            <button onClick={logoutUser} className="label-mono text-red-400 hover:text-red-300 transition">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="label-mono text-slate-300 hover:text-white transition">Login</Link>
                            <Link to="/register" className="label-mono text-slate-300 hover:text-white transition">Register</Link>
                        </>
                    )}
                    <Link to="/cart" className="label-mono relative bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition">
                        Cart
                        {count > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {count}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;