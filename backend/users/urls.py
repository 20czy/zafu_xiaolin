from django.urls import path
from .views import LoginView, LogoutView, csrf, get_user_preferences

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('csrf/', csrf, name='csrf'),
    path('preferences/', get_user_preferences, name='user-preferences'),
]