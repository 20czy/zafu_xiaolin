from django.db import migrations
from datetime import date

def create_initial_clubs(apps, schema_editor):
    Club = apps.get_model('academic', 'Club')
    clubs_data = [
        {
            'club_id': 'PHOTO001',
            'club_name': '摄影协会',
            'description': '致力于培养学生的摄影技能和艺术鉴赏能力',
            'president': '张三',
            'contact_email': 'photo@example.com',
            'member_count': 50,
            'founded_date': date(2020, 9, 1),
            'status': 'active'
        },
        {
            'club_id': 'DANCE002',
            'club_name': '街舞社',
            'description': '探索现代舞蹈艺术，培养舞蹈爱好者',
            'president': '李四',
            'contact_email': 'dance@example.com',
            'member_count': 30,
            'founded_date': date(2019, 3, 15),
            'status': 'active'
        },
        {
            'club_id': 'TECH003',
            'club_name': '编程俱乐部',
            'description': '培养编程兴趣，提升技术能力',
            'president': '王五',
            'contact_email': 'code@example.com',
            'member_count': 45,
            'founded_date': date(2021, 2, 28),
            'status': 'active'
        }
    ]
    
    for club_data in clubs_data:
        Club.objects.create(**club_data)

class Migration(migrations.Migration):
    dependencies = [
        ('academic', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_initial_clubs),
    ]