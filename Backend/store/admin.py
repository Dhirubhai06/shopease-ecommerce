from django.contrib import admin, messages

from .models import Address, Category, Order, OrderItem, Product, Wishlist
from .order_flow import OrderTransitionError, change_status


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock')
    list_filter = ('category',)
    search_fields = ('name', 'description')


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'created_at')


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'label', 'phone')
    search_fields = ('user__username', 'phone')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'quantity', 'price')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'total_amount',
                    'payment_method', 'is_paid', 'status', 'created_at')
    list_filter = ('status', 'payment_method', 'is_paid')
    search_fields = ('id', 'user__username', 'phone')
    # status sirf neeche ke actions se badle, taaki rules aur stock restore bypass na ho
    readonly_fields = ('user', 'status', 'total_amount', 'is_paid',
                       'razorpay_order_id', 'razorpay_payment_id', 'created_at')
    inlines = [OrderItemInline]
    actions = ['mark_shipped', 'mark_delivered', 'mark_cancelled']

    def _apply(self, request, queryset, new_status):
        done = 0
        for order in queryset:
            try:
                change_status(order.id, new_status)
                done += 1
            except OrderTransitionError as error:
                self.message_user(request, str(error), level=messages.WARNING)
        if done:
            self.message_user(
                request, f"{done} order(s) marked {new_status}.", level=messages.SUCCESS)

    @admin.action(description="Mark selected orders as shipped")
    def mark_shipped(self, request, queryset):
        self._apply(request, queryset, 'shipped')

    @admin.action(description="Mark selected orders as delivered")
    def mark_delivered(self, request, queryset):
        self._apply(request, queryset, 'delivered')

    @admin.action(description="Cancel selected orders (restores stock)")
    def mark_cancelled(self, request, queryset):
        self._apply(request, queryset, 'cancelled')
