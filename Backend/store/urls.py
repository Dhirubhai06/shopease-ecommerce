from django.urls import path
from . import views
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

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
    path('orders/<int:pk>/cancel/', views.cancel_order),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'),
         name='swagger-ui'),
    path('orders/<int:pk>/invoice/', views.order_invoice),
]
