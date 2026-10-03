import json

from django.contrib.auth.models import User
from django.test import TestCase

from .models import Category, Order, OrderItem, Product


class CheckoutOrderAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='guestuser', password='secret123')
        self.category = Category.objects.create(name='Laptops', slug='laptops')
        self.product = Product.objects.create(
            name='Gaming Laptop',
            description='Fast laptop',
            price=1200.00,
            category=self.category,
            stock=10,
            available=True,
        )

    def test_checkout_creates_order_from_cart(self):
        response = self.client.post(
            '/api/orders/checkout/',
            data=json.dumps({
                'shipping_address': '123 Main Street',
                'items': [
                    {'id': self.product.id, 'quantity': 2}
                ]
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(OrderItem.objects.count(), 1)
        self.assertEqual(Order.objects.get().total_amount, 2400.00)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

    def test_checkout_rejects_unknown_product(self):
        response = self.client.post(
            '/api/orders/checkout/',
            data=json.dumps({
                'shipping_address': '123 Main Street',
                'items': [
                    {'id': 99999, 'quantity': 1}
                ]
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)

    def test_create_order_saves_checkout_details(self):
        response = self.client.post(
            '/api/orders/create',
            data=json.dumps({
                'address': '123 Main Street',
                'phone': '5551234567',
                'payment_method': 'upi',
                'items': [{'id': self.product.id, 'quantity': 1}],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get()
        self.assertEqual(order.shipping_address, '123 Main Street')
        self.assertEqual(order.phone, '5551234567')
        self.assertEqual(order.payment_method, 'upi')

    def test_create_order_requires_checkout_details(self):
        response = self.client.post(
            '/api/orders/create',
            data=json.dumps(
                {'items': [{'id': self.product.id, 'quantity': 1}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_failed_order_rolls_back_order_items_and_stock(self):
        response = self.client.post(
            '/api/orders/create',
            data=json.dumps({
                'address': '123 Main Street',
                'phone': '5551234567',
                'payment_method': 'cod',
                'items': [
                    {'id': self.product.id, 'quantity': 2},
                    {'id': self.product.id, 'quantity': 99},
                ],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)
