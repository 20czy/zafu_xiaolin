# Generated by Django 5.1.5 on 2025-03-13 13:35

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_remove_user_is_admin_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="bio",
            field=models.TextField(blank=True, null=True, verbose_name="个人简介"),
        ),
        migrations.AddField(
            model_name="user",
            name="interests",
            field=models.TextField(blank=True, null=True, verbose_name="兴趣爱好"),
        ),
    ]
