import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_order_confirmation(order):
    """Order place hone ke baad confirmation email. Fail ho to order par asar nahi padta."""
    user = order.user
    if not user or not user.email:
        return  # email nahi hai to skip

    lines = []
    for item in order.items.select_related("product"):
        line_total = item.price * item.quantity
        lines.append(
            f"- {item.product.name} x {item.quantity}  =  Rs. {line_total}")

    message = (
        f"Hi {user.username},\n\n"
        f"Thanks for your order! Your order #{order.id} has been placed.\n\n"
        f"Items:\n" + "\n".join(lines) + "\n\n"
        f"Total: Rs. {order.total_amount}\n"
        f"Payment method: {order.get_payment_method_display()}\n\n"
        f"Delivery address:\n{order.shipping_address}\n"
        f"Phone: {order.phone}\n\n"
        f"Status: {order.status}\n\n"
        f"- Team ShopEase (demo store, no real order)\n"
    )

    try:
        send_mail(
            subject=f"Order #{order.id} confirmed - ShopEase",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        # email fail hone par order cancel nahi hona chahiye
        logger.exception(
            "Could not send confirmation email for order %s", order.id)
