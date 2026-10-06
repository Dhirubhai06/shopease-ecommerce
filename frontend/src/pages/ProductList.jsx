import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";

function ProductList() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // filters
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");      // search ka debounced value
    const [category, setCategory] = useState("");
    const [sort, setSort] = useState("");

    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL;

    // categories ek baar
    useEffect(() => {
        fetch(`${BASE_URL}/api/categories/`)
            .then((res) => res.json())
            .then((data) => setCategories(Array.isArray(data) ? data : []))
            .catch(() => setCategories([]));
    }, [BASE_URL]);

    // typing rukne ke 350ms baad hi search chale
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search.trim()), 350);
        return () => clearTimeout(timer);
    }, [search]);

    // products, filters badalne par
    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams();
        if (query) params.set("search", query);
        if (category) params.set("category", category);
        if (sort) params.set("sort", sort);

        setLoading(true);
        setError(null);

        fetch(`${BASE_URL}/api/products/?${params.toString()}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch products");
                }
                return response.json();
            })
            .then((data) => {
                setProducts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message);
                setLoading(false);
            });

        return () => controller.abort();
    }, [BASE_URL, query, category, sort]);

    const hasFilters = search || category || sort;
    const clearFilters = () => {
        setSearch("");
        setQuery("");
        setCategory("");
        setSort("");
    };

    const inputClass = "rounded-md border border-gray-300 p-2.5 text-sm";

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Our Products</h1>

            {/* filters: hamesha dikhte rahenge, taaki typing ke beech input band na ho */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] mb-6">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    aria-label="Search products"
                    className={inputClass}
                />
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Filter by category"
                    className={`${inputClass} bg-white`}
                >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort products"
                    className={`${inputClass} bg-white`}
                >
                    <option value="">Sort: Default</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="newest">Newest first</option>
                </select>
            </div>

            {error ? (
                <p className="text-center text-red-600 mt-10">Error: {error}</p>
            ) : loading && products.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="text-center text-gray-600 mt-10">
                    <p className="mb-3">No products found.</p>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ProductList;