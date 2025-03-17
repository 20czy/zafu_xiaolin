from django.urls import path
from .views import LoginView, RegisterView, LogoutView, csrf, get_user_preferences

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', RegisterView.as_view(), name='register'),
    path('csrf/', csrf, name='csrf'),
     path('preferences/', get_user_preferences, name='user-preferences'),
]