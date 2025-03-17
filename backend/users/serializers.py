from rest_framework import serializers
from .models import User

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['interests', 'bio']