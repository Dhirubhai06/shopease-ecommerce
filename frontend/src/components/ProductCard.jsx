import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import HeartButton from "./HeartButton";

function ProductCard({ product }) {
  const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL || "";
  const { addToCart } = useCart();

  const getProductImageUrl = (image) => {
    if (!image) return "https://placehold.co/600x400?text=No+Image";
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    const cleanBaseUrl = BASEURL.replace(/\/+$/, "");
    const cleanImagePath = image.startsWith("/") ? image : `/${image}`;
    return `${cleanBaseUrl}${cleanImagePath}`;
  };

  const handleAddToCart = (event) => {
    event.preventDefault();
    addToCart(product);
  };

  return (
    // NAYA: "relative" class
    <div className="relative bg-slate-900 rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 border border-slate-800">
      {/* NAYA: heart button */}
      <HeartButton productId={product.id} />

      <Link to={`/product/${product.id}`} className="block">
        <img
          src={getProductImageUrl(product.image)}
          alt={product.name}
          className="w-full h-56 object-cover rounded-lg mb-4"
        />
      </Link>

      <Link to={`/product/${product.id}`} className="block">
        <h2 className="text-lg font-semibold text-white truncate">
          {product.name}
        </h2>
      </Link>

      <p className="text-slate-300 text-sm line-clamp-2 mb-3">{product.description}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-white font-semibold">₹{product.price}</p>
        <button
          onClick={handleAddToCart}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default ProductCard;