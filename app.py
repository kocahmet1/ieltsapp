import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import requests
import json
import uuid
from datetime import datetime # Changed import for datetime
import threading
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy # Added SQLAlchemy import
from werkzeug.security import generate_password_hash, check_password_hash # Added check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user # Added Flask-Login imports

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'a_default_fallback_secret_key') # Needed for Flask-Login session management
CORS(app)

# Configure SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/ielts_practice.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Optional: suppress a warning
db = SQLAlchemy(app)

# Configure Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
# If using API-based auth, you might not redirect but return 401s.
# login_manager.login_view = 'api_login' # Or a frontend route that shows the login form

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Configure Google Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Create storage directories if they don't exist
PRACTICE_SETS_DIR = Path('practice_sets')
PRACTICE_SETS_DIR.mkdir(exist_ok=True)

JOBS_DIR = Path('jobs')
JOBS_DIR.mkdir(exist_ok=True)

# Store the latest practice set ID
current_practice_set_id = None

# Store active jobs
jobs = {}

# Job statuses
JOB_STATUS_PENDING = 'pending'
JOB_STATUS_COMPLETED = 'completed'
JOB_STATUS_FAILED = 'failed'

@app.route('/')
def index():
    """Render the main application page"""
    practice_id = request.args.get('id', None)
    return render_template('index.html', practice_id=practice_id)

# --- SQLAlchemy Models ---
class User(db.Model, UserMixin): # Inherit from UserMixin
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    practice_set_id = db.Column(db.String(100), nullable=False) # Could be the UUID of the practice set
    score_fitb = db.Column(db.String(20), nullable=True)
    score_tfng = db.Column(db.String(20), nullable=True)
    score_mh = db.Column(db.String(20), nullable=True)
    date_attempted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('progress_records', lazy=True))

    def __repr__(self):
        return f'<Progress user_id={self.user_id} set_id={self.practice_set_id} date={self.date_attempted}>'
# --- End SQLAlchemy Models ---

# --- Auth Routes ---
@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username and password cannot be empty'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already taken'}), 409 # Conflict

    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password_hash=hashed_password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error during registration: {str(e)}") # Log the error
        return jsonify({'message': 'Registration failed due to a server error.'}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400

    user = User.query.filter_by(username=username).first()

    if user and check_password_hash(user.password_hash, password):
        login_user(user) # Manages the user session
        return jsonify({'message': 'Login successful', 'user': {'username': user.username}}), 200
    
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required # Ensures only logged-in users can logout
def api_logout():
    logout_user() # Clears the user session
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/current_user', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({'isLoggedIn': True, 'user': {'username': current_user.username}}), 200
    else:
        return jsonify({'isLoggedIn': False}), 200 # Or 401 if you prefer clients to handle that for redirection

@app.route('/api/save_progress', methods=['POST'])
@login_required
def save_progress_route():
    data = request.get_json()
    practice_set_id = data.get('practice_set_id')
    score_fitb = data.get('score_fitb')
    score_tfng = data.get('score_tfng')
    score_mh = data.get('score_mh')

    if not practice_set_id:
        return jsonify({'message': 'Practice set ID is required'}), 400

    # Check if progress for this set and user already exists
    existing_progress = Progress.query.filter_by(
        user_id=current_user.id,
        practice_set_id=practice_set_id
    ).first()

    if existing_progress:
        # Update existing record
        if score_fitb is not None:
            existing_progress.score_fitb = score_fitb
        if score_tfng is not None:
            existing_progress.score_tfng = score_tfng
        if score_mh is not None:
            existing_progress.score_mh = score_mh
        existing_progress.date_attempted = datetime.utcnow()
        message = 'Progress updated successfully'
    else:
        # Create new record
        new_progress = Progress(
            user_id=current_user.id,
            practice_set_id=practice_set_id,
            score_fitb=score_fitb,
            score_tfng=score_tfng,
            score_mh=score_mh
            # date_attempted is handled by default
        )
        db.session.add(new_progress)
        message = 'Progress saved successfully'
        
    try:
        db.session.commit()
        return jsonify({'message': message}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error saving progress: {str(e)}")
        return jsonify({'message': 'Failed to save progress due to a server error.'}), 500

@app.route('/api/get_progress', methods=['GET'])
@login_required
def get_progress_route():
    user_progress = Progress.query.filter_by(user_id=current_user.id).order_by(Progress.date_attempted.desc()).all()
    progress_list = []
    for p_record in user_progress:
        record_data = {
            'practice_set_id': p_record.practice_set_id,
            'score_fitb': p_record.score_fitb,
            'score_tfng': p_record.score_tfng,
            'score_mh': p_record.score_mh,
            'date_attempted': p_record.date_attempted.strftime('%Y-%m-%d %H:%M:%S') if p_record.date_attempted else None
        }
        progress_list.append(record_data)
    return jsonify(progress_list), 200

# --- End Auth Routes ---


@app.route('/api/generate', methods=['POST'])
def generate_practice():
    """Start an asynchronous process to generate a new IELTS practice set"""
    # Get data from the request
    data = request.get_json() or {}
    custom_api_key = data.get('apiKey', '')
    
    # Use the custom API key if provided, otherwise fall back to environment key
    api_key_to_use = custom_api_key if custom_api_key else GEMINI_API_KEY
    
    if not api_key_to_use:
        return jsonify({"error": "No Gemini API key available"}), 500
    
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    
    # Create job status object
    job_status = {
        'id': job_id,
        'status': JOB_STATUS_PENDING,
        'created_at': datetime.now().isoformat(), # Use imported datetime
        'practice_set_id': None,
        'error': None
    }
    
    # Save initial job status
    save_job_status(job_id, job_status)
    
    # Get the requested question type, default to 'fitb'
    question_type = data.get('question_type', 'fitb')
    
    # Start the generation process in a background thread
    thread = threading.Thread(
        target=generate_practice_async,
        args=(job_id, api_key_to_use, question_type)
    )
    thread.daemon = True  # Thread will exit when main thread exits
    thread.start()
    
    # Immediately return the job ID to the client
    return jsonify({
        'job_id': job_id,
        'status': JOB_STATUS_PENDING
    })

def generate_practice_async(job_id, api_key_to_use, question_type='fitb'):
    """Asynchronously generate a practice set based on question type"""
    global current_practice_set_id
    
    try:
        # Configure the model with API key
        genai.configure(api_key=api_key_to_use)
        model = genai.GenerativeModel('models/gemini-2.5-pro-preview-03-25')
        
        prompt_fitb_tfng = """
        Generate an IELTS reading practice set with the following components:

        1. A reading passage (800-1000 words) on a general interest topic suitable for IELTS Academic.
        2. 5 "fill-in-the-blank" questions based on the passage.
        3. 5 "True/False/Not Given" questions based on the passage.
        4. For each "fill-in-the-blank" question, include the exact sentence from the passage where the answer can be found.

        IMPORTANT:
        - The fill-in-the-blank questions should be challenging:
          * Use substantial paraphrasing of the original text
          * Rephrase, reorder, and restructure the sentences from the passage
          * Use synonyms and alternative phrasing while preserving meaning
          * Avoid directly copying phrases from the passage except for the blank part
        - The fill-in-the-blank answers must still be exact words or short phrases copied directly from the passage.
        - For True/False/Not Given questions, the answer must be exactly "True", "False", or "Not Given".
        - For each True/False/Not Given question, you MUST include a relevant_passage field that contains the EXACT text from the passage that relates to the statement. This text must be a direct copy of 1-2 sentences from the passage without any modifications.

        Return the result in the following JSON format:
        {
            "passage": "Full text of the reading passage...",
            "questions": [
                {
                    "id": 1,
                    "question_type": "FITB",
                    "question": "The text containing a _____ where a word from the passage should go.",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer."
                },
                {
                    "id": 2,
                    "question_type": "FITB",
                    "question": "The text containing a _____ where a word from the passage should go.",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer."
                },
                {
                    "id": 3,
                    "question_type": "FITB",
                    "question": "The text containing a _____ where a word from the passage should go.",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer."
                },
                {
                    "id": 4,
                    "question_type": "FITB",
                    "question": "The text containing a _____ where a word from the passage should go.",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer."
                },
                {
                    "id": 5,
                    "question_type": "FITB",
                    "question": "The text containing a _____ where a word from the passage should go.",
                    "answer": "exact word or phrase from the passage",
                    "source_sentence": "The complete sentence from the passage that contains the answer."
                },
                {
                    "id": 6,
                    "question_type": "TFNG",
                    "statement": "A statement to evaluate against the passage.",
                    "answer": "True",
                    "relevant_passage": "The portion of the passage that is relevant to this statement."
                },
                {
                    "id": 7,
                    "question_type": "TFNG",
                    "statement": "A statement to evaluate against the passage.",
                    "answer": "True",
                    "relevant_passage": "The portion of the passage that is relevant to this statement."
                },
                {
                    "id": 8,
                    "question_type": "TFNG",
                    "statement": "A statement to evaluate against the passage.",
                    "answer": "True",
                    "relevant_passage": "The portion of the passage that is relevant to this statement."
                },
                {
                    "id": 9,
                    "question_type": "TFNG",
                    "statement": "A statement to evaluate against the passage.",
                    "answer": "True",
                    "relevant_passage": "The portion of the passage that is relevant to this statement."
                },
                {
                    "id": 10,
                    "question_type": "TFNG",
                    "statement": "A statement to evaluate against the passage.",
                    "answer": "True",
                    "relevant_passage": "The portion of the passage that is relevant to this statement."
                }
            ],
            "question_type": "mixed_fitb_tfng" 
        }
        """

        prompt_matching_headings = """
        Generate an IELTS "Matching Headings" reading practice set with the following components:

        1.  A reading passage (600-900 words) on a general interest topic suitable for IELTS Academic.
            The passage should be divided into 3 to 5 distinct paragraphs.
        2.  A list of headings. There should be 2 to 3 more headings than the number of paragraphs.
        3.  The correct mapping of each paragraph to its corresponding heading.

        Return the result in the following JSON format:
        {
            "passage": "Full text of the reading passage...",
            "paragraphs": [
                {"id": "A", "content": "Text of paragraph A..."},
                {"id": "B", "content": "Text of paragraph B..."},
                {"id": "C", "content": "Text of paragraph C..."}
            ],
            "headings": [
                {"id": "i", "text": "Heading text 1"},
                {"id": "ii", "text": "Heading text 2"},
                {"id": "iii", "text": "Heading text 3"},
                {"id": "iv", "text": "Heading text 4"},
                {"id": "v", "text": "Heading text 5"}
            ],
            "answers": {
                "A": "iii",
                "B": "i",
                "C": "v"
            },
            "question_type": "matching_headings"
        }

        IMPORTANT:
        - The 'passage' field should contain the entire reading passage as a single string.
        - The 'paragraphs' field must be a list of objects, where each object has:
            - "id": A string identifier for the paragraph (e.g., "A", "B", "C").
            - "content": The full text of that paragraph.
        - The 'headings' field must be a list of objects, where each object has:
            - "id": A string identifier for the heading (e.g., "i", "ii", "iii", "iv", "v").
            - "text": The text of the heading.
        - The 'answers' field must be an object mapping each paragraph "id" (e.g., "A") to the correct heading "id" (e.g., "iii").
        - The 'question_type' field must be the string "matching_headings".
        - Ensure the number of headings is greater than the number of paragraphs by 2 or 3.
        - Ensure paragraph and heading IDs are distinct and follow the specified format (letters for paragraphs, Roman numerals for headings).
        """
        
        if question_type == 'matching_headings':
            prompt = prompt_matching_headings
        else: # Default to FITB/TFNG
            prompt = prompt_fitb_tfng
            
        # Generate the response
        try:
            # Generate content with the model
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40
                }
            )
            
            # Extract the JSON from the response
            response_text = response.text
        except Exception as generation_error:
            print(f"Error in generation: {str(generation_error)}")
            update_job_status(job_id, {
                'status': JOB_STATUS_FAILED,
                'error': f"API timeout or generation error: {str(generation_error)}"
            })
            return
        
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
        practice_set['created_at'] = datetime.now().isoformat() # Use imported datetime
        practice_set['shareUrl'] = f"//?id={practice_id}"
        
        # Save the practice set to a file
        save_practice_set(practice_id, practice_set)
        
        # Update the current practice set ID
        current_practice_set_id = practice_id
        
        # Update the job status to completed with the practice set ID
        update_job_status(job_id, {
            'status': JOB_STATUS_COMPLETED,
            'practice_set_id': practice_id
        })
        
    except Exception as e:
        print(f"Error generating practice set: {str(e)}")
        update_job_status(job_id, {
            'status': JOB_STATUS_FAILED,
            'error': str(e)
        })

def save_practice_set(practice_id, practice_set):
    """Save a practice set to a file"""
    practice_file = PRACTICE_SETS_DIR / f"{practice_id}.json"
    with open(practice_file, 'w', encoding='utf-8') as f:
        json.dump(practice_set, f, ensure_ascii=False, indent=2)
        
def save_job_status(job_id, job_status):
    """Save job status to a file"""
    job_file = JOBS_DIR / f"{job_id}.json"
    with open(job_file, 'w', encoding='utf-8') as f:
        json.dump(job_status, f, ensure_ascii=False, indent=2)
    
def load_job_status(job_id):
    """Load job status from a file"""
    job_file = JOBS_DIR / f"{job_id}.json"
    if not job_file.exists():
        return None
        
    with open(job_file, 'r', encoding='utf-8') as f:
        return json.load(f)
        
def update_job_status(job_id, updates):
    """Update job status with new values"""
    job_status = load_job_status(job_id)
    if job_status:
        job_status.update(updates)
        save_job_status(job_id, job_status)

def load_practice_set(practice_id):
    """Load a practice set from a file"""
    practice_file = PRACTICE_SETS_DIR / f"{practice_id}.json"
    if not practice_file.exists():
        return None
    
    with open(practice_file, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.route('/api/job-status', methods=['GET'])
def check_job_status():
    """Check the status of an asynchronous job"""
    job_id = request.args.get('job_id')
    
    if not job_id:
        return jsonify({"error": "No job ID provided"}), 400
    
    job_status = load_job_status(job_id)
    
    if job_status is None:
        return jsonify({"error": "Job not found"}), 404
    
    # If job is completed, include the practice set ID
    if job_status['status'] == JOB_STATUS_COMPLETED and job_status['practice_set_id']:
        practice_id = job_status['practice_set_id']
        practice_set = load_practice_set(practice_id)
        
        if practice_set:
            # Return both job status and the practice set
            return jsonify({
                **job_status,
                'practice_set': practice_set
            })
    
    # Otherwise just return the job status
    return jsonify(job_status)

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
    # Get data from the request
    data = request.get_json()
    word = data.get('word', '')
    custom_api_key = data.get('apiKey', '')
    
    # Use the custom API key if provided, otherwise fall back to environment key
    api_key_to_use = custom_api_key if custom_api_key else GEMINI_API_KEY
    
    if not api_key_to_use:
        return jsonify({"error": "No Gemini API key available"}), 500
    
    try:
        if not word:
            return jsonify({"error": "No word provided"}), 400
        
        # Configure the model with potentially custom API key
        genai.configure(api_key=api_key_to_use)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Create the prompt for translation
        prompt = f"Translate the English word '{word}' to Turkish. Return only the Turkish translation, nothing else."
        
        # Generate the response with simpler settings for translation
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.2,
                "top_p": 0.95,
                "max_output_tokens": 50  # Short response for translations
            }
        )
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
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass # Already exists

    with app.app_context():
        db.create_all() # Creates tables from models
        
    # Add timeout configuration for gunicorn when running with it
    app.config['TIMEOUT'] = 120  # 2 minute timeout
    app.run(debug=True, host='0.0.0.0', port=5000)
