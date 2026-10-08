import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";

function ProductList() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chips, setChips] = useState([]);       // AI ne query se kya samjha

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

    // typing rukne ke 600ms baad hi search chale (AI quota bachane ke liye)
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search.trim()), 600);
        return () => clearTimeout(timer);
    }, [search]);

    // products: query ho to AI search, nahi to normal list
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        const normalFetch = async (withSearch) => {
            const params = new URLSearchParams();
            if (withSearch && query) params.set("search", query);
            if (category) params.set("category", category);
            if (sort) params.set("sort", sort);
            const response = await fetch(`${BASE_URL}/api/products/?${params.toString()}`, { signal });
            if (!response.ok) throw new Error("Failed to fetch products");
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        };

        const aiFetch = async () => {
            const response = await fetch(`${BASE_URL}/api/ai-search/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
                signal,
            });
            if (!response.ok) throw new Error("AI search failed");
            const data = await response.json();

            let list = Array.isArray(data.products) ? data.products : [];

            // dropdowns AI search ke upar bhi kaam karein
            if (category) {
                list = list.filter((p) => String(p.category?.id) === String(category));
            }
            if (sort === "price_asc") {
                list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
            } else if (sort === "price_desc") {
                list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
            } else if (sort === "newest") {
                list = [...list].sort((a, b) => b.id - a.id);
            }
            return { list, understood: Array.isArray(data.understood) ? data.understood : [] };
        };

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                if (query) {
                    try {
                        const { list, understood } = await aiFetch();
                        setProducts(list);
                        setChips(understood);
                    } catch (err) {
                        if (err.name === "AbortError") return;
                        // AI band / rate limit: normal keyword search chalao
                        setChips([]);
                        setProducts(await normalFetch(true));
                    }
                } else {
                    setChips([]);
                    setProducts(await normalFetch(false));
                }
                setLoading(false);
            } catch (err) {
                if (err.name === "AbortError") return;
                setError(err.message);
                setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [BASE_URL, query, category, sort]);

    const hasFilters = search || category || sort;
    const clearFilters = () => {
        setSearch("");
        setQuery("");
        setCategory("");
        setSort("");
        setChips([]);
    };

    const inputClass = "rounded-md border border-gray-300 p-2.5 text-sm";

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Our Products</h1>

            {/* filters: hamesha dikhte rahenge, taaki typing ke beech input band na ho */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] mb-3">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search products... (try "30000 ke neeche achha phone")'
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

            {/* AI ne kya samjha: chips */}
            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-sm text-gray-500">Understood:</span>
                    {chips.map((chip) => (
                        <span
                            key={chip}
                            className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm"
                        >
                            {chip}
                        </span>
                    ))}
                </div>
            )}
            {chips.length === 0 && <div className="mb-3" />}

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
