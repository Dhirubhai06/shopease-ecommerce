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
                <Link to="/" className="font-bold text-lg text-white">ShopEase</Link>

                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {token ? (
                        <>
                            <Link to="/orders" className="text-slate-300 hover:text-white">My Orders</Link>
                            <Link to="/profile" className="text-slate-300 hover:text-white">Hi, {username}</Link>
                            <Link to="/wishlist" className="text-slate-300 hover:text-white">Wishlist</Link>
                            <button onClick={logoutUser} className="text-red-400 hover:text-red-300">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-slate-300 hover:text-white">Login</Link>
                            <Link to="/register" className="text-slate-300 hover:text-white">Register</Link>
                        </>
                    )}
                    <Link to="/cart" className="relative bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition">
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