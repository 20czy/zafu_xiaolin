from django.core.management.base import BaseCommand
from academic.models import Course
from datetime import time

class Command(BaseCommand):
    help = '加载测试课程数据'

    def handle(self, *args, **kwargs):
        # 清除现有数据
        Course.objects.all().delete()

        # 计算机专业课程
        computer_courses = [
            {
                'course_id': 'CS101',
                'course_name': '计算机导论',
                'instructor': '张教授',
                'major': '计算机科学',
                'semester': '2023-2024-2',
                'day_of_week': 1,
                'start_time': time(8, 0),
                'end_time': time(9, 40),
                'classroom': 'A101'
            },
            {
                'course_id': 'CS102',
                'course_name': '数据结构',
                'instructor': '李教授',
                'major': '计算机科学',
                'semester': '2023-2024-2',
                'day_of_week': 2,
                'start_time': time(10, 0),
                'end_time': time(11, 40),
                'classroom': 'A102'
            },
        ]

        # 电子信息专业课程
        electronic_courses = [
            {
                'course_id': 'EE101',
                'course_name': '电路原理',
                'instructor': '王教授',
                'major': '电子信息',
                'semester': '2023-2024-2',
                'day_of_week': 1,
                'start_time': time(10, 0),
                'end_time': time(11, 40),
                'classroom': 'B101'
            },
            {
                'course_id': 'EE102',
                'course_name': '数字电路',
                'instructor': '刘教授',
                'major': '电子信息',
                'semester': '2023-2024-2',
                'day_of_week': 3,
                'start_time': time(14, 0),
                'end_time': time(15, 40),
                'classroom': 'B102'
            },
        ]

        # 批量创建课程
        for course in computer_courses + electronic_courses:
            Course.objects.create(**course)

        self.stdout.write(self.style.SUCCESS('成功加载测试课程数据'))