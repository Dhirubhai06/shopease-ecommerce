function ProductCardSkeleton() {
    return (
        <div className="bg-slate-900 rounded-xl shadow-md p-4 border border-slate-800">
            <div className="skeleton h-56 w-full mb-4" />
            <div className="skeleton h-5 w-3/4 mb-3" />
            <div className="skeleton h-3 w-full mb-2" />
            <div className="skeleton h-3 w-5/6 mb-4" />
            <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-9 w-28" />
            </div>
        </div>
    );
}

export default ProductCardSkeleton;