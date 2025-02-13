from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import PDFDocument, ChatSession, ChatMessage
import os
import mock
from django.conf import settings
from django.urls import reverse
import json

class ChatViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.chat_session = ChatSession.objects.create(title="Test Session")
        self.valid_payload = {
            'message': '你好，招标有什么要求？',
            'session_id': self.chat_session.id
        }
    
    def test_missing_message(self):
        payload = {'session_id': self.chat_session.id}
        response = self.client.post(
            reverse('chat'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_missing_session_id(self):
        payload = {'message': '测试消息'}
        response = self.client.post(
            reverse('chat'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_invalid_session_id(self):
        payload = {'message': '测试消息', 'session_id': 999}
        response = self.client.post(
            reverse('chat'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @mock.patch('yourapp.views.create_llm')
    def test_successful_chat(self, mock_llm):
        # 模拟LLM响应
        mock_response = mock.MagicMock()
        mock_response.content = "这是一个测试响应"
        mock_llm.return_value.invoke.return_value = mock_response
        
        initial_count = ChatMessage.objects.count()
        
        response = self.client.post(
            reverse('chat'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(ChatMessage.objects.count(), initial_count + 2)
        self.assertIn('测试响应', response.data['data']['content'])
    
    def test_invalid_json(self):
        response = self.client.post(
            reverse('chat'),
            data='invalid json',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

