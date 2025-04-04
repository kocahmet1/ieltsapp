import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import requests
import json
import uuid
import datetime
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Configure Google Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Create storage directory for practice sets if it doesn't exist
PRACTICE_SETS_DIR = Path('practice_sets')
PRACTICE_SETS_DIR.mkdir(exist_ok=True)

# Store the latest practice set ID
current_practice_set_id = None

@app.route('/')
def index():
    """Render the main application page"""
    practice_id = request.args.get('id', None)
    return render_template('index.html', practice_id=practice_id)

@app.route('/api/generate', methods=['POST'])
def generate_practice():
    """Generate a new IELTS practice set using Gemini API"""
    global current_practice_set_id
    
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured"}), 500
    
    try:
        # Configure the model
        model = genai.GenerativeModel('gemini-2.5-pro-exp-03-25')
        
        # Create the prompt for generating an IELTS practice set
        prompt = """
        Generate an IELTS reading practice set with the following components:
        
        1. A reading passage (800-1000 words) on a general interest topic.
        2. 3-5 "fill-in-the-blank" questions based on the passage.
        3. For each question, include the exact sentence from the passage where the answer can be found.
        
        IMPORTANT: The fill-in-the-blank answers must be exact words or short phrases copied directly from the passage.
        
        Return the result in the following JSON format:
        {
            "passage": "Full text of the reading passage...",
            "questions": [
                {
                    "id": 1,
                    "question": "The text containing a _____ where a word from the passage should go",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer"
                },
                ...more questions...
            ]
        }
        """
        
        # Generate the response
        response = model.generate_content(prompt)
        
        # Extract the JSON from the response
        response_text = response.text
        
        # Find JSON content within the response (handling potential markdown code blocks)
        json_content = response_text
        if "```json" in response_text:
            json_content = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_content = response_text.split("```")[1].split("```")[0].strip()
            
        # Parse the JSON
        practice_set = json.loads(json_content)
        
        # Generate a unique ID for this practice set
        practice_id = str(uuid.uuid4())
        
        # Add metadata to the practice set
        practice_set['id'] = practice_id
        practice_set['created_at'] = datetime.datetime.now().isoformat()
        
        # Save the practice set to a file
        save_practice_set(practice_id, practice_set)
        
        # Update the current practice set ID
        current_practice_set_id = practice_id
        
        # Return the practice set with its ID
        return jsonify({
            **practice_set,
            "shareUrl": f"{request.host_url}?id={practice_id}"
        })
    
    except Exception as e:
        print(f"Error generating practice set: {str(e)}")
        return jsonify({"error": str(e)}), 500

def save_practice_set(practice_id, practice_set):
    """Save a practice set to a file"""
    practice_file = PRACTICE_SETS_DIR / f"{practice_id}.json"
    with open(practice_file, 'w', encoding='utf-8') as f:
        json.dump(practice_set, f, ensure_ascii=False, indent=2)

def load_practice_set(practice_id):
    """Load a practice set from a file"""
    practice_file = PRACTICE_SETS_DIR / f"{practice_id}.json"
    if not practice_file.exists():
        return None
    
    with open(practice_file, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.route('/api/practice-set', methods=['GET'])
def get_practice_set():
    """Retrieve a practice set by ID or the most recent one"""
    practice_id = request.args.get('id', current_practice_set_id)
    
    if practice_id is None:
        return jsonify({"error": "No practice set has been generated yet"}), 404
    
    practice_set = load_practice_set(practice_id)
    if practice_set is None:
        return jsonify({"error": "Practice set not found"}), 404
    
    # Add the share URL to the response
    practice_set['shareUrl'] = f"{request.host_url}?id={practice_id}"
    
    return jsonify(practice_set)

@app.route('/api/translate', methods=['POST'])
def translate_word():
    """Translate a word from English to Turkish using Gemini API"""
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured"}), 500
    
    try:
        data = request.get_json()
        word = data.get('word', '')
        
        if not word:
            return jsonify({"error": "No word provided"}), 400
        
        # Configure the model
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Create the prompt for translation
        prompt = f"Translate the English word '{word}' to Turkish. Return only the Turkish translation, nothing else."
        
        # Generate the response
        response = model.generate_content(prompt)
        translation = response.text.strip()
        
        return jsonify({"word": word, "translation": translation})
    
    except Exception as e:
        print(f"Error translating word: {str(e)}")
        return jsonify({"error": str(e)}), 500

def flask_app_handle_request(method, path, body_content=''):
    """
    Handle requests from the Netlify serverless function
    """
    from io import StringIO
    import sys
    from flask import Request
    from werkzeug.test import EnvironBuilder
    import json
    
    # Create a request context for Flask to handle
    builder = EnvironBuilder(path=path, method=method, data=body_content)
    env = builder.get_environ()
    req = Request(env)
    
    # Capture the response
    old_stdout = sys.stdout
    redirected_output = StringIO()
    sys.stdout = redirected_output
    
    # Handle the request with Flask
    with app.request_context(env):
        # Find the right route handler
        for rule in app.url_map.iter_rules():
            if rule.match(path):
                # Call the view function with the request
                view_func = app.view_functions[rule.endpoint]
                response = view_func()
                break
        else:
            # No route matched, return 404
            response = jsonify({"error": "Not Found"}), 404
    
    # Restore stdout
    sys.stdout = old_stdout
    
    # Process the response
    if isinstance(response, tuple):
        body, status_code = response
        headers = {}
    else:
        body = response
        status_code = 200
        headers = {}
    
    # Convert response object to JSON string if it's not already a string
    if hasattr(body, 'get_json'):
        # It's a Flask response object
        body_content = body.get_data(as_text=True)
        for header, value in body.headers.items():
            headers[header] = value
    elif isinstance(body, dict):
        # It's a dictionary
        body_content = json.dumps(body)
        headers['Content-Type'] = 'application/json'
    else:
        # It's something else, convert to string
        body_content = str(body)
    
    # Return a JSON-serializable response for the Netlify function
    return json.dumps({
        "status_code": status_code,
        "headers": headers,
        "body": body_content
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
