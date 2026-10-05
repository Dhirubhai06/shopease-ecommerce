from django.db import transaction

from .models import Order, Product


class OrderTransitionError(Exception):
    """Order ko is status par nahi le ja sakte."""


ALLOWED_TRANSITIONS = {
    'pending': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [],
    'cancelled': [],
}


@transaction.atomic
def change_status(order_id, new_status):
    order = Order.objects.select_for_update().get(id=order_id)

    if new_status not in ALLOWED_TRANSITIONS.get(order.status, []):
        raise OrderTransitionError(
            f"Order #{order.id} cannot go from {order.status} to {new_status}."
        )

    if new_status == 'shipped' and order.payment_method != 'cod' and not order.is_paid:
        raise OrderTransitionError(
            f"Order #{order.id} is not paid yet, so it cannot be shipped.")

    if new_status == 'cancelled':
        if order.is_paid:
            raise OrderTransitionError(
                "Paid orders cannot be cancelled here. Please contact support for a refund."
            )
        # product id ke order me lock, taaki do cancel ek saath aaye to deadlock na ho
        for item in order.items.order_by('product_id'):
            product = Product.objects.select_for_update().get(id=item.product_id)
            product.stock += item.quantity
            product.save(update_fields=['stock'])

    if new_status == 'delivered' and order.payment_method == 'cod':
        order.is_paid = True   # cash on delivery: payment delivery par mili

    order.status = new_status
    order.save(update_fields=['status', 'is_paid'])
    return order
