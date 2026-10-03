import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";

function HeartButton({ productId }) {
    const { token } = useAuth();
    const { isWishlisted, toggleWishlist } = useWishlist();
    const navigate = useNavigate();
    const active = isWishlisted(productId);

    const handleClick = (e) => {
        e.preventDefault();   // card ka Link na khule
        e.stopPropagation();
        if (!token) {
            navigate("/login");
            return;
        }
        toggleWishlist(productId);
    };

    return (
        <button
            onClick={handleClick}
            aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-xl"
        >
            {active ? "❤️" : "🤍"}
        </button>
    );
}

export default HeartButton;