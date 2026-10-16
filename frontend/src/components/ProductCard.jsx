import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import HeartButton from "./HeartButton";

function ProductCard({ product }) {
  const BASEURL = import.meta.env.VITE_DJANGO_BASE_URL || "";
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

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
    if (added) return;
    addToCart(product);
    setAdded(true);
  };

  return (
    <div className="product-card relative rounded-xl shadow-md p-4">
      <HeartButton productId={product.id} />

      <Link to={`/product/${product.id}`} className="block overflow-hidden rounded-lg mb-4">
        <img
          src={getProductImageUrl(product.image)}
          alt={product.name}
          className="w-full h-56 object-cover"
        />
      </Link>

      <Link to={`/product/${product.id}`} className="block">
        <h2 className="card-title text-lg font-semibold truncate">
          {product.name}
        </h2>
      </Link>

      <p className="card-text text-sm line-clamp-2 mb-3">{product.description}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="card-title label-mono">₹{product.price}</p>        <button
          onClick={handleAddToCart}
          disabled={added}
          aria-live="polite"
          className={`text-white px-4 py-2 rounded-lg transition ${added ? "bg-green-600 cursor-default" : "bg-blue-600 hover:bg-blue-700"
            }`}
        >
          {added ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

export default ProductCard;