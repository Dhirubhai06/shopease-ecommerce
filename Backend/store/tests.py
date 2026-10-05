from django.core import mail
from itertools import count
from django.utils.text import slugify
import hashlib
import hmac
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from .models import Address, Category, Order, Product, Wishlist


# ---------- helpers ----------
_counter = count(1)


def _unique_slug(model, text):
    # slug field ho to unique slug do, nahi ho to kuch nahi
    if any(f.name == "slug" for f in model._meta.get_fields()):
        return {"slug": f"{slugify(text)}-{next(_counter)}"}
    return {}


def make_category(name="Test Category"):
    return Category.objects.create(name=name, **_unique_slug(Category, name))


def make_product(name="Test Product", price="500.00", stock=10, category=None):
    category = category or make_category()
    return Product.objects.create(
        name=name,
        description="Test description",
        price=Decimal(price),
        stock=stock,
        category=category,
        **_unique_slug(Product, name),
    )


def login(client, user):
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


# ---------- auth ----------
class AuthTests(APITestCase):
    def test_register_returns_token(self):
        response = self.client.post("/api/register/", {
            "username": "newuser", "email": "new@example.com", "password": "Pass12345",
        })
        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user("taken", "t@example.com", "Pass12345")
        response = self.client.post("/api/register/", {
            "username": "taken", "email": "x@example.com", "password": "Pass12345",
        })
        self.assertEqual(response.status_code, 400)

    def test_login_success(self):
        User.objects.create_user("jimmy", "j@example.com", "Pass12345")
        response = self.client.post(
            "/api/login/", {"username": "jimmy", "password": "Pass12345"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)

    def test_login_wrong_password(self):
        User.objects.create_user("jimmy", "j@example.com", "Pass12345")
        response = self.client.post(
            "/api/login/", {"username": "jimmy", "password": "wrong"})
        self.assertEqual(response.status_code, 400)

    def test_change_password_rotates_token(self):
        user = User.objects.create_user("jimmy", "j@example.com", "Pass12345")
        login(self.client, user)
        old_key = Token.objects.get(user=user).key

        bad = self.client.post("/api/change-password/", {
            "old_password": "wrong", "new_password": "S0me-Strong-Pass!9",
        })
        self.assertEqual(bad.status_code, 400)

        good = self.client.post("/api/change-password/", {
            "old_password": "Pass12345", "new_password": "S0me-Strong-Pass!9",
        })
        self.assertEqual(good.status_code, 200)
        self.assertNotEqual(good.data["token"], old_key)

        self.client.credentials()
        relogin = self.client.post(
            "/api/login/", {"username": "jimmy", "password": "S0me-Strong-Pass!9"})
        self.assertEqual(relogin.status_code, 200)


# ---------- products ----------
class ProductTests(APITestCase):
    def setUp(self):
        self.phones = make_category("Phones")
        self.kitchen = make_category("Kitchen")
        self.phone = make_product(
            "Vivo Phone", "24000.00", category=self.phones)
        self.cooker = make_product(
            "Pressure Cooker", "1000.00", category=self.kitchen)

    def test_list_returns_all_products(self):
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_search_filters_by_name(self):
        response = self.client.get("/api/products/", {"search": "cooker"})
        self.assertEqual([p["name"]
                         for p in response.data], ["Pressure Cooker"])

    def test_category_filter(self):
        response = self.client.get(
            "/api/products/", {"category": self.phones.id})
        self.assertEqual([p["name"] for p in response.data], ["Vivo Phone"])

    def test_sort_by_price_descending(self):
        response = self.client.get("/api/products/", {"sort": "price_desc"})
        self.assertEqual(response.data[0]["name"], "Vivo Phone")

    def test_missing_product_returns_404(self):
        response = self.client.get("/api/products/99999/")
        self.assertEqual(response.status_code, 404)


# ---------- checkout ----------
class OrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "buyer", "b@example.com", "Pass12345")
        self.other = User.objects.create_user(
            "other", "o@example.com", "Pass12345")
        self.product = make_product(price="500.00", stock=5)
        login(self.client, self.user)

    def payload(self, **overrides):
        data = {
            "address": "Jaipur",
            "phone": "9876543210",
            "payment_method": "cod",
            "items": [{"id": self.product.id, "quantity": 2}],
        }
        data.update(overrides)
        return data

    def test_order_requires_login(self):
        self.client.credentials()
        response = self.client.post(
            "/api/orders/create/", self.payload(), format="json")
        self.assertEqual(response.status_code, 401)

    def test_order_reduces_stock_and_calculates_total(self):
        response = self.client.post(
            "/api/orders/create/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.total_amount, Decimal("1000.00"))
        self.assertFalse(order.is_paid)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_client_cannot_set_the_price(self):
        data = self.payload(
            items=[{"id": self.product.id, "quantity": 1, "price": "1.00"}])
        response = self.client.post("/api/orders/create/", data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Order.objects.get(
            id=response.data["id"]).total_amount, Decimal("500.00"))

    def test_rejects_quantity_above_stock(self):
        data = self.payload(items=[{"id": self.product.id, "quantity": 6}])
        response = self.client.post("/api/orders/create/", data, format="json")
        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)          # stock waisa hi
        self.assertEqual(Order.objects.count(), 0)       # transaction rollback

    def test_rejects_empty_cart(self):
        response = self.client.post(
            "/api/orders/create/", self.payload(items=[]), format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_phone(self):
        response = self.client.post(
            "/api/orders/create/", self.payload(phone="123"), format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_payment_method(self):
        response = self.client.post(
            "/api/orders/create/", self.payload(payment_method="bitcoin"), format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_users_only_see_their_own_orders(self):
        self.client.post("/api/orders/create/", self.payload(), format="json")

        mine = self.client.get("/api/orders/")
        self.assertEqual(len(mine.data), 1)

        login(self.client, self.other)
        theirs = self.client.get("/api/orders/")
        self.assertEqual(len(theirs.data), 0)


# ---------- addresses and wishlist ----------
class AddressAndWishlistTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            "owner", "ow@example.com", "Pass12345")
        self.other = User.objects.create_user(
            "other", "ot@example.com", "Pass12345")
        self.product = make_product()

    def test_user_cannot_delete_another_users_address(self):
        address = Address.objects.create(
            user=self.owner, label="Home", address="Jaipur", phone="9876543210")
        login(self.client, self.other)
        response = self.client.delete(f"/api/addresses/{address.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Address.objects.filter(id=address.id).exists())

    def test_address_rejects_invalid_phone(self):
        login(self.client, self.owner)
        response = self.client.post("/api/addresses/", {
            "label": "Home", "address": "Jaipur", "phone": "123",
        })
        self.assertEqual(response.status_code, 400)

    def test_wishlist_toggle_adds_and_removes(self):
        login(self.client, self.owner)
        added = self.client.post(f"/api/wishlist/toggle/{self.product.id}/")
        self.assertTrue(added.data["wishlisted"])
        self.assertEqual(Wishlist.objects.filter(user=self.owner).count(), 1)

        removed = self.client.post(f"/api/wishlist/toggle/{self.product.id}/")
        self.assertFalse(removed.data["wishlisted"])
        self.assertEqual(Wishlist.objects.filter(user=self.owner).count(), 0)


# ---------- payments ----------
@override_settings(RAZORPAY_KEY_ID="rzp_test_dummy", RAZORPAY_KEY_SECRET="dummy_secret")
class PaymentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("payer", "", "Pass12345")
        self.other = User.objects.create_user("intruder", "", "Pass12345")
        self.order = Order.objects.create(
            user=self.user,
            shipping_address="Jaipur",
            phone="9876543210",
            payment_method="upi",
            total_amount=Decimal("500.00"),
            razorpay_order_id="order_TEST123",
        )
        login(self.client, self.user)

    def signature(self, order_id, payment_id):
        return hmac.new(
            b"dummy_secret", f"{order_id}|{payment_id}".encode(
            ), hashlib.sha256
        ).hexdigest()

    def test_verify_rejects_wrong_signature(self):
        response = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": "order_TEST123",
            "razorpay_payment_id": "pay_TEST456",
            "razorpay_signature": "fake-signature",
        })
        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertFalse(self.order.is_paid)

    def test_verify_accepts_valid_signature(self):
        response = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": "order_TEST123",
            "razorpay_payment_id": "pay_TEST456",
            "razorpay_signature": self.signature("order_TEST123", "pay_TEST456"),
        })
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertTrue(self.order.is_paid)
        self.assertEqual(self.order.razorpay_payment_id, "pay_TEST456")

    def test_other_user_cannot_verify_my_order(self):
        login(self.client, self.other)
        response = self.client.post("/api/payments/verify/", {
            "razorpay_order_id": "order_TEST123",
            "razorpay_payment_id": "pay_TEST456",
            "razorpay_signature": self.signature("order_TEST123", "pay_TEST456"),
        })
        self.assertEqual(response.status_code, 404)
        self.order.refresh_from_db()
        self.assertFalse(self.order.is_paid)

    def test_other_user_cannot_start_payment_for_my_order(self):
        login(self.client, self.other)
        response = self.client.post(
            "/api/payments/create/", {"order_id": self.order.id})
        self.assertEqual(response.status_code, 404)

# ---------- cancel order ----------


@override_settings(RAZORPAY_KEY_ID="rzp_test_dummy", RAZORPAY_KEY_SECRET="dummy_secret")
class CancelOrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "buyer", "b@example.com", "Pass12345")
        self.other = User.objects.create_user(
            "other", "o@example.com", "Pass12345")
        self.product = make_product(price="500.00", stock=5)
        login(self.client, self.user)
        response = self.client.post("/api/orders/create/", {
            "address": "Jaipur", "phone": "9876543210", "payment_method": "cod",
            "items": [{"id": self.product.id, "quantity": 2}],
        }, format="json")
        self.order_id = response.data["id"]

    def stock(self):
        self.product.refresh_from_db()
        return self.product.stock

    def test_cancel_restores_stock(self):
        self.assertEqual(self.stock(), 3)
        response = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "cancelled")
        self.assertEqual(self.stock(), 5)

    def test_cannot_cancel_twice(self):
        self.client.post(f"/api/orders/{self.order_id}/cancel/")
        again = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(self.stock(), 5)            # stock dobara nahi badha

    def test_cannot_cancel_paid_order(self):
        Order.objects.filter(id=self.order_id).update(is_paid=True)
        response = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.stock(), 3)

    def test_other_user_cannot_cancel(self):
        login(self.client, self.other)
        response = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.stock(), 3)

    def test_cancel_requires_login(self):
        self.client.credentials()
        response = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(response.status_code, 401)

    def test_cannot_start_payment_for_cancelled_order(self):
        self.client.post(f"/api/orders/{self.order_id}/cancel/")
        Order.objects.filter(id=self.order_id).update(payment_method="upi")
        response = self.client.post(
            "/api/payments/create/", {"order_id": self.order_id})
        self.assertEqual(response.status_code, 400)

# ---------- emails ----------


class OrderEmailTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "buyer", "b@example.com", "Pass12345")
        self.product = make_product(stock=5)
        login(self.client, self.user)

    def place(self, method):
        return self.client.post("/api/orders/create/", {
            "address": "Jaipur", "phone": "9876543210", "payment_method": method,
            "items": [{"id": self.product.id, "quantity": 1}],
        }, format="json")

    def test_cod_order_sends_exactly_one_email(self):
        self.place("cod")
        self.assertEqual(len(mail.outbox), 1)

    def test_online_order_sends_no_email_before_payment(self):
        self.place("upi")
        self.assertEqual(len(mail.outbox), 0)
