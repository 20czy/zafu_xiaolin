from django.db import models

# Create your models here.
class Course(models.Model):
    course_id = models.CharField(max_length=20, unique=True)
    course_name = models.CharField(max_length=100)
    instructor = models.CharField(max_length=50)
    major = models.CharField(max_length=50)
    semester = models.CharField(max_length=20)
    day_of_week = models.IntegerField(choices=[
        (1, '周一'),
        (2, '周二'),
        (3, '周三'),
        (4, '周四'),
        (5, '周五'),
        (6, '周六'),
        (7, '周日'),
    ])
    start_time = models.TimeField()
    end_time = models.TimeField()
    classroom = models.CharField(max_length=50)

    class Meta:
        db_table = 'academic_course'
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.course_name} - {self.instructor}"
    
class Club(models.Model):
    club_id = models.CharField(max_length=20, unique=True)
    club_name = models.CharField(max_length=100)
    description = models.TextField()
    president = models.CharField(max_length=50)
    contact_email = models.EmailField()
    member_count = models.IntegerField(default=0)
    founded_date = models.DateField()
    status = models.CharField(max_length=20, choices=[
        ('active', '活跃'),
        ('inactive', '不活跃'),
        ('disbanded', '已解散'),
    ])

    class Meta:
        db_table = 'academic_club'
        ordering = ['club_name']

    def __str__(self):
        return f"{self.club_name} - {self.president}"
