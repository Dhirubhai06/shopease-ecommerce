import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import HeartButton from "./HeartButton";

function ProductCard({ product }) {
  const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL || "";
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  // 1.5 second baad button wapas normal
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

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
    setAdded(true);
  };

  return (
    // BADLA: "product-card" jodा, "hover:shadow-lg transition-shadow" hataya
    <div className="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-300">
      <HeartButton productId={product.id} />

      {/* BADLA: image ko overflow-hidden wrapper me daala, taaki zoom bahar na nikle */}
      <Link to={`/product/${product.id}`} className="block overflow-hidden rounded-lg mb-4">
        <img
          src={getProductImageUrl(product.image)}
          alt={product.name}
          className="w-full h-56 object-cover"
        />
      </Link>

      <Link to={`/product/${product.id}`} className="block">
        <h2 className="text-lg font-semibold text-gray-800 truncate">
          {product.name}
        </h2>
      </Link>

      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{product.description}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-gray-800 font-semibold">₹{product.price}</p>
        <button
          onClick={handleAddToCart}
          aria-live="polite"
          className={`text-white px-4 py-2 rounded-lg transition ${added ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
            }`}
        >
          {added ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

export default ProductCard;