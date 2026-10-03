from django.contrib.auth.models import User
from django.db import transaction
from fastapi.datastructures import Address
from rest_framework import serializers
from .models import Product, Category, Order, OrderItem, Address


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Product
        fields = '__all__'


# ---------- Order history (padhne ke liye) ----------
class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = '__all__'


# ---------- Order create (likhne ke liye) ----------
class OrderItemInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemInputSerializer(many=True, write_only=True)
    phone = serializers.RegexField(
        r"^\d{10}$",
        error_messages={"invalid": "Enter a valid 10 digit phone number"},
    )

    class Meta:
        model = Order
        fields = ["id", "address", "phone", "payment_method",
                  "items", "total_price", "status"]
        read_only_fields = ["id", "total_price", "status"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Cart is empty")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        total = 0
        for item in items:
            try:
                product = Product.objects.get(id=item["product"])
            except Product.DoesNotExist:
                raise serializers.ValidationError(
                    f"Product {item['product']} not found")
            OrderItem.objects.create(
                order=order, product=product,
                quantity=item["quantity"], price=product.price,
            )
            total += product.price * item["quantity"]
        order.total_price = total
        order.save()
        return order


# ---------- Register ----------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class AddressSerializer(serializers.ModelSerializer):
    phone = serializers.RegexField(
        r"^\d{10}$",
        error_messages={"invalid": "Enter a valid 10 digit phone number"},
    )

    class Meta:
        model = Address
        fields = ["id", "label", "address", "phone"]
