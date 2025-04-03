from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import requests
import json
import uuid
import datetime
import os
from pathlib import Path
import sys

# Add the parent directory to sys.path to be able to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app import app as flask_app

# Create handler for the serverless function
def handler(event, context):
    # Extract the path and HTTP method from the event
    path = event.get('path', '').lstrip('/.netlify/functions/api')
    http_method = event.get('httpMethod', 'GET')
    
    # Create a WSGI environment dictionary
    environ = {
        'REQUEST_METHOD': http_method,
        'PATH_INFO': path,
        'QUERY_STRING': event.get('queryStringParameters', {}),
        'CONTENT_LENGTH': len(event.get('body', '')) if event.get('body') else 0,
        'CONTENT_TYPE': event.get('headers', {}).get('content-type', ''),
        'wsgi.input': event.get('body', ''),
        'HTTP_USER_AGENT': event.get('headers', {}).get('user-agent', ''),
        'HTTP_HOST': event.get('headers', {}).get('host', ''),
    }
    
    # Create a response object to capture the Flask app's output
    response = {
        'statusCode': 200,
        'headers': {'Content-Type': 'text/html'},
        'body': ''
    }
    
    # Create a function to capture the Flask app's output
    def start_response(status, headers):
        response['statusCode'] = int(status.split(' ')[0])
        for key, value in headers:
            response['headers'][key] = value
    
    # Call the Flask app with the environment
    output = flask_app(environ, start_response)
    response['body'] = ''.join([chunk.decode('utf-8') for chunk in output])
    
    return response
