from django.urls import path
from . import views

urlpatterns = [
    path('products/', views.get_products),
    path('products/<int:pk>/', views.get_product),
    path('categories/', views.get_categories),
    path('orders/create/', views.create_order),
    path('orders/', views.my_orders),
    path('register/', views.register),
    path('login/', views.login),
    path('profile/', views.profile),
    path('change-password/', views.change_password),
    path('wishlist/', views.wishlist),
    path('wishlist/toggle/<int:pk>/', views.toggle_wishlist),
    path('addresses/', views.addresses),
    path('addresses/<int:pk>/', views.delete_address),
    path('payments/create/', views.create_payment),
    path('payments/verify/', views.verify_payment),
    path('payments/create/', views.create_payment),   
    path('payments/verify/', views.verify_payment),   
]

