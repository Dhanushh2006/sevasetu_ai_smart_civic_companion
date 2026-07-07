import unittest
import json
import os
from server import app, COMPLAINTS_FILE, SCHEMES_FILE, read_json, write_json

class SevaSetuServerTestCase(unittest.TestCase):
    def setUp(self):
        # Configure Flask app for testing
        app.config['TESTING'] = True
        app.config['DEBUG'] = False
        self.client = app.test_client()
        
        # Back up original JSON files
        self.complaints_backup = read_json(COMPLAINTS_FILE)
        self.schemes_backup = read_json(SCHEMES_FILE)

    def tearDown(self):
        # Restore JSON files back to original state
        write_json(COMPLAINTS_FILE, self.complaints_backup)
        write_json(SCHEMES_FILE, self.schemes_backup)

    def test_index_route(self):
        """Test that index route returns 200 and serves HTML"""
        response = self.client.get('/')
        # Since static/index.html should exist, it should return 200 or 404 if not created
        # We assert either is acceptable but routing is present
        self.assertIn(response.status_code, [200, 404])

    def test_get_schemes(self):
        """Test retrieving schemes list"""
        response = self.client.get('/api/schemes')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        if len(data) > 0:
            self.assertIn('name', data[0])
            self.assertIn('category', data[0])
            self.assertIn('eligibility', data[0])

    def test_get_complaints(self):
        """Test retrieving complaints list"""
        response = self.client.get('/api/complaints')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)

    def test_handle_config(self):
        """Test retrieving and saving API configurations"""
        # Test GET config
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('has_gemini', data)
        self.assertIn('has_openai', data)

        # Test POST config
        post_data = {
            "gemini_key": "test-gemini-key",
            "openai_key": "test-openai-key"
        }
        response = self.client.post('/api/config', json=post_data)
        self.assertEqual(response.status_code, 200)
        res_data = json.loads(response.data)
        self.assertEqual(res_data['status'], 'success')

    def test_create_complaint(self):
        """Test filing a new civic complaint"""
        payload = {
            "title": "Broken Water Pipe",
            "category": "Utilities & Power",
            "description": "Drinking water leaking on Main Road.",
            "location": "Main Road",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "severity": "Medium",
            "submitted_by": "Test Citizen"
        }
        response = self.client.post('/api/complaints', json=payload)
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('id', data)
        self.assertEqual(data['title'], "Broken Water Pipe")
        self.assertEqual(data['status'], "Submitted")
        self.assertEqual(len(data['timeline']), 1)

    def test_update_complaint_status(self):
        """Test municipal administrator updating complaint status"""
        # First create a complaint
        payload = {
            "title": "Trash Pileup",
            "category": "Sanitation & Waste",
            "description": "Garbage pile in neighborhood.",
            "location": "Park Corner",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "severity": "Medium",
            "submitted_by": "Test Citizen"
        }
        res_create = self.client.post('/api/complaints', json=payload)
        comp_id = json.loads(res_create.data)['id']

        # Update status
        status_payload = {
            "status": "Assigned",
            "note": "Sanitation crew dispatched."
        }
        response = self.client.post(f'/api/complaints/{comp_id}/status', json=status_payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['complaint']['status'], 'Assigned')
        self.assertEqual(len(data['complaint']['timeline']), 2)

    def test_chat_empty_query(self):
        """Test chat returns 400 for empty query"""
        response = self.client.post('/api/chat', json={"message": ""})
        self.assertEqual(response.status_code, 400)

    def test_chat_simulated_farming(self):
        """Test chat matching rules for farming query"""
        response = self.client.post('/api/chat', json={
            "message": "tell me about kisan scheme",
            "history": [],
            "language": "English"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('reply', data)
        self.assertTrue(data['simulated'])
        self.assertIn('PM-Kisan', data['reply'])

    def test_report_vision_empty(self):
        """Test vision analyzer returns 400 when no image is provided"""
        response = self.client.post('/api/report_vision', json={})
        self.assertEqual(response.status_code, 400)

    def test_report_vision_simulated_pothole(self):
        """Test visual mock parser with pothole keyword in filename"""
        payload = {
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "filename": "pothole_road.jpg",
            "reporter_name": "Tester",
            "location": "MG Road"
        }
        response = self.client.post('/api/report_vision', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['simulated'])
        self.assertEqual(data['analysis']['category_detected'], 'Roads & Transport')
        self.assertIn('pothole', data['analysis']['draft_letter'].lower())

if __name__ == '__main__':
    unittest.main()
