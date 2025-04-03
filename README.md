# IELTS Reading Practice Application

This web application helps IELTS students practice the "fill-in-the-blank using words from the passage" reading question type. The application generates practice sets using the Google Gemini AI model and provides interactive help features.

## Key Features

- **AI-Powered Content Generation**: Generates IELTS-style reading passages with fill-in-the-blank questions
- **Reveal Relevant Section**: Highlights the exact section in the passage where the answer can be found
- **Click-to-Translate**: Translates words from English to Turkish when clicked
- **Interactive Question Checking**: Provides immediate feedback on answers

## Project Structure

```
ielts-practice-app/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (API keys)
├── static/                # Static assets
│   ├── css/
│   │   └── styles.css     # Application styling
│   └── js/
│       └── app.js         # Frontend JavaScript
└── templates/
    └── index.html         # Main HTML template
```

## Setup Instructions

### Prerequisites

- Python 3.7+ installed
- Google Gemini API key (get from [Google AI Studio](https://ai.google.dev/))

### Installation

1. Clone or download this repository:
   ```
   git clone https://github.com/yourusername/ielts-practice-app.git
   cd ielts-practice-app
   ```

2. Create a virtual environment (recommended):
   ```
   python -m venv venv
   venv\Scripts\activate  # On Windows
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure your Google Gemini API key:
   - Edit the `.env` file and replace `your_api_key_here` with your actual Google Gemini API key

### Running the Application

1. Start the Flask application:
   ```
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

## Usage Instructions

1. **Generate Practice Set**: Click the "Generate New Practice Set" button to create a new reading passage with questions.

2. **Answer Questions**: Type your answers in the input fields. Click "Check Answer" to verify if your answer is correct.

3. **Get Hints**: Click the "Reveal Hint" button next to a question to highlight the relevant section in the passage.

4. **Translate Words**: Click on any word in the passage to see its Turkish translation.

## Technical Details

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **AI API**: Google Gemini API
- **Translation**: Google Gemini API with translation prompt

## License

This project is intended for educational purposes.
