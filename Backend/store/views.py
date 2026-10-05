from django.db.models import Q
import razorpay
from django.conf import settings
from .emails import send_order_confirmation
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.db import transaction
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Address, Product, Category, Order, OrderItem, Wishlist, Address
from .serializers import (
    ProductSerializer,
    CategorySerializer,
    OrderSerializer,
    RegisterSerializer,
    AddressSerializer,
)


class CheckoutError(Exception):
    pass


def home(request):
    return JsonResponse({'message': 'Welcome to the E-commerce Store!'})


@api_view(['GET'])
def get_products(request):
    products = Product.objects.all()

    # ?search=cooker  (name ya description me dhundhe)
    search = request.query_params.get('search', '').strip()
    if search:
        products = products.filter(
            Q(name__icontains=search) | Q(description__icontains=search)
        )

    # ?category=2
    category = request.query_params.get('category', '')
    if category.isdigit():
        products = products.filter(category_id=int(category))

    # ?sort=price_asc | price_desc | newest
    sort_options = {
        'price_asc': 'price',
        'price_desc': '-price',
        'newest': '-id',
    }
    sort = request.query_params.get('sort')
    if sort in sort_options:
        products = products.order_by(sort_options[sort])

    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def get_product(request, pk):
    try:
        product = Product.objects.get(id=pk)
        serializer = ProductSerializer(product, context={'request': request})
        return Response(serializer.data)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)


@api_view(['GET'])
def get_categories(request):
    categories = Category.objects.all()
    serializer = CategorySerializer(categories, many=True)
    return Response(serializer.data)


# ---------------- Auth ----------------

@api_view(['POST'])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'username': user.username}, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
def login(request):
    user = authenticate(
        username=request.data.get('username'),
        password=request.data.get('password'),
    )
    if not user:
        return Response({'error': 'Invalid username or password'}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'username': user.username})


# ---------------- Orders ----------------

def _create_order(request, require_checkout_details):
    cart_items = request.data.get('items', [])
    shipping_address = request.data.get(
        'address', request.data.get('shipping_address', '')).strip()
    phone = request.data.get('phone', '').strip()
    payment_method = request.data.get('payment_method', 'cod')

    if not cart_items:
        return Response({'error': 'Cart is empty'}, status=400)
    if require_checkout_details and (not shipping_address or not phone or not payment_method):
        return Response({'error': 'Address, phone, and payment method are required'}, status=400)
    if phone and (not phone.isdigit() or len(phone) != 10):
        return Response({'error': 'Enter a valid 10 digit phone number'}, status=400)
    if payment_method not in dict(Order.PAYMENT_METHOD_CHOICES):
        return Response({'error': 'Choose a valid payment method'}, status=400)

    user = request.user  # login wala user (guest nahi)
    try:
        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                shipping_address=shipping_address or 'Not provided',
                phone=phone,
                payment_method=payment_method,
                total_amount=Decimal('0.00'),
            )
            total_amount = Decimal('0.00')

            for item in cart_items:
                product_id = item.get('id')
                try:
                    quantity = int(item.get('quantity', 1))
                except (TypeError, ValueError):
                    raise CheckoutError(
                        'Each cart item must include a valid product id and quantity')

                if not product_id or quantity <= 0:
                    raise CheckoutError(
                        'Each cart item must include a valid product id and quantity')

                try:
                    product = Product.objects.select_for_update().get(id=product_id)
                except Product.DoesNotExist:
                    raise CheckoutError(
                        f'Product with id {product_id} was not found')

                if product.stock < quantity:
                    raise CheckoutError(
                        f'Only {product.stock} units available for {product.name}')

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    price=product.price,
                )
                total_amount += Decimal(str(product.price)) * quantity
                product.stock -= quantity
                product.save(update_fields=['stock'])

            order.total_amount = total_amount
            order.status = 'pending'
            order.save(update_fields=['total_amount', 'status'])
            if payment_method == 'cod':
                send_order_confirmation(order)
        send_order_confirmation(order)
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data, status=201)
    except CheckoutError as error:
        return Response({'error': str(error)}, status=400)
    except Exception:
        return Response({'error': 'Unable to complete checkout'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order(request):
    return _create_order(request, require_checkout_details=True)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout_order(request):
    return _create_order(request, require_checkout_details=False)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_orders(request):
    orders = (
        Order.objects.filter(user=request.user)
        .prefetch_related('items__product')
        .order_by('-id')
    )
    serializer = OrderSerializer(
        orders, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user

    if request.method == 'PATCH':
        username = request.data.get('username', user.username).strip()
        email = request.data.get('email', user.email).strip()

        if not username:
            return Response({'error': 'Username cannot be empty'}, status=400)
        if User.objects.exclude(pk=user.pk).filter(username=username).exists():
            return Response({'error': 'This username is already taken'}, status=400)

        user.username = username
        user.email = email
        user.save()

    return Response({
        'username': user.username,
        'email': user.email,
        'date_joined': user.date_joined,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get('old_password', '')
    new_password = request.data.get('new_password', '')

    if not request.user.check_password(old_password):
        return Response({'error': 'Old password is incorrect'}, status=400)

    try:
        validate_password(new_password, request.user)
    except ValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=400)

    request.user.set_password(new_password)
    request.user.save()

    Token.objects.filter(user=request.user).delete()
    token = Token.objects.create(user=request.user)

    return Response({'message': 'Password changed successfully', 'token': token.key})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def wishlist(request):
    items = (
        Wishlist.objects.filter(user=request.user)
        .select_related('product')
        .order_by('-created_at')
    )
    products = [item.product for item in items]
    serializer = ProductSerializer(
        products, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_wishlist(request, pk):
    try:
        product = Product.objects.get(id=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    item, created = Wishlist.objects.get_or_create(
        user=request.user, product=product)
    if not created:
        item.delete()  # pehle se tha to hata do
    return Response({'wishlisted': created})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def addresses(request):
    if request.method == 'POST':
        serializer = AddressSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    items = Address.objects.filter(user=request.user)
    return Response(AddressSerializer(items, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_address(request, pk):
    try:
        item = Address.objects.get(
            id=pk, user=request.user)  # sirf apna address
    except Address.DoesNotExist:
        return Response({'error': 'Address not found'}, status=404)
    item.delete()
    return Response(status=204)


def _razorpay_client():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment(request):
    try:
        order = Order.objects.get(
            id=request.data.get('order_id'), user=request.user)
    except (Order.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Order not found'}, status=404)

    if order.is_paid:
        return Response({'error': 'Order is already paid'}, status=400)
    if order.payment_method == 'cod':
        return Response({'error': 'This order is Cash on Delivery'}, status=400)
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return Response({'error': 'Payment is not configured'}, status=500)

    # amount paise me, aur total database se (frontend se nahi)
    amount = int((order.total_amount * 100).quantize(Decimal('1')))
    try:
        rp_order = _razorpay_client().order.create({
            'amount': amount,
            'currency': 'INR',
            'receipt': f'order_{order.id}',
        })
    except Exception:
        return Response({'error': 'Unable to start payment'}, status=502)

    order.razorpay_order_id = rp_order['id']
    order.save(update_fields=['razorpay_order_id'])

    return Response({
        'key': settings.RAZORPAY_KEY_ID,
        'razorpay_order_id': rp_order['id'],
        'amount': amount,
        'currency': 'INR',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    razorpay_order_id = request.data.get('razorpay_order_id')
    razorpay_payment_id = request.data.get('razorpay_payment_id')
    razorpay_signature = request.data.get('razorpay_signature')

    if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
        return Response({'error': 'Missing payment details'}, status=400)

    try:
        order = Order.objects.get(
            razorpay_order_id=razorpay_order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found'}, status=404)

    try:
        _razorpay_client().utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        return Response({'error': 'Payment verification failed'}, status=400)

    if not order.is_paid:
        order.is_paid = True
        order.razorpay_payment_id = razorpay_payment_id
        order.save(update_fields=['is_paid', 'razorpay_payment_id'])
        send_order_confirmation(order)

    return Response({'message': 'Payment successful', 'order_id': order.id})
