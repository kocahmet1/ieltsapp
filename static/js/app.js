// DOM Elements
const generateBtn = document.getElementById('generateBtn');
const loadingIndicator = document.getElementById('loading');
const practiceArea = document.getElementById('practiceArea');
const passageElement = document.getElementById('passage');
const questionsElement = document.getElementById('questions');
const translationModal = document.getElementById('translationModal');
const translatedWordElement = document.getElementById('translatedWord');
const closeTranslationBtn = document.getElementById('closeTranslation');
const shareUrlContainer = document.createElement('div'); // Will be added dynamically

// Current practice set data
let currentPracticeSet = null;
let activeHighlight = null;
let currentPracticeId = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
generateBtn.addEventListener('click', generatePracticeSet);
closeTranslationBtn.addEventListener('click', hideTranslationModal);

function initialize() {
    // Check for practice ID in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const practiceId = urlParams.get('id');
    
    if (practiceId) {
        // If ID is in URL, fetch that specific practice set
        fetchExistingPracticeSet(practiceId);
    } else {
        // Otherwise check if there's a recently generated set
        fetchExistingPracticeSet();
    }
    
    // Add click event for word translation
    passageElement.addEventListener('click', handleWordClick);
}

async function fetchExistingPracticeSet(practiceId = null) {
    try {
        // Construct URL with optional ID parameter
        let url = '/api/practice-set';
        if (practiceId) {
            url += `?id=${practiceId}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            currentPracticeSet = data;
            currentPracticeId = data.id;
            displayPracticeSet(data);
        }
    } catch (error) {
        console.error('Error fetching existing practice set:', error);
    }
}

async function generatePracticeSet() {
    try {
        // Show loading indicator
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        
        // Clear any existing highlights
        clearHighlights();
        
        // Make API request to generate new practice set
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        currentPracticeSet = data;
        
        // Display the practice set
        displayPracticeSet(data);
    } catch (error) {
        console.error('Error generating practice set:', error);
        alert('Error generating practice set. Please try again.');
    } finally {
        // Hide loading indicator
        loadingIndicator.classList.add('hidden');
        generateBtn.disabled = false;
    }
}

function displayPracticeSet(practiceSet) {
    if (!practiceSet || !practiceSet.passage || !practiceSet.questions) {
        console.error('Invalid practice set data:', practiceSet);
        return;
    }
    
    // Display the passage
    passageElement.textContent = practiceSet.passage;
    
    // Display the questions
    questionsElement.innerHTML = '';
    practiceSet.questions.forEach(question => {
        const questionElement = createQuestionElement(question);
        questionsElement.appendChild(questionElement);
    });
    
    // Display share URL if available
    if (practiceSet.shareUrl) {
        // Create or update share URL container
        shareUrlContainer.className = 'share-url-container';
        shareUrlContainer.innerHTML = `
            <p>Share this practice set with your students:</p>
            <div class="share-url-box">
                <input type="text" readonly value="${practiceSet.shareUrl}" class="share-url-input" />
                <button class="btn copy-btn">Copy</button>
            </div>
        `;
        
        // Add to DOM if not already there
        if (!document.querySelector('.share-url-container')) {
            practiceArea.insertBefore(shareUrlContainer, practiceArea.firstChild);
        }
        
        // Add copy functionality
        const copyBtn = shareUrlContainer.querySelector('.copy-btn');
        const urlInput = shareUrlContainer.querySelector('.share-url-input');
        
        copyBtn.addEventListener('click', () => {
            urlInput.select();
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        });
    }
    
    // Show the practice area
    practiceArea.classList.remove('hidden');
}

function createQuestionElement(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.dataset.questionId = question.id;
    
    // Create question text
    const questionTextP = document.createElement('p');
    questionTextP.className = 'question-text';
    questionTextP.textContent = question.question;
    
    // Create answer input
    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    answerInput.className = 'answer-input';
    answerInput.placeholder = 'Your answer...';
    answerInput.dataset.correctAnswer = question.answer;
    
    // Add event listener for checking answer
    answerInput.addEventListener('input', handleAnswerInput);
    
    // Create action buttons
    const actionDiv = document.createElement('div');
    actionDiv.className = 'question-actions';
    
    // Create reveal hint button
    const revealBtn = document.createElement('button');
    revealBtn.className = 'btn secondary';
    revealBtn.textContent = 'Related Sentence';
    revealBtn.dataset.sourceSentence = question.source_sentence;
    revealBtn.addEventListener('click', handleRevealHint);
    
    // Create check answer button
    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn';
    checkBtn.textContent = 'Check Answer';
    checkBtn.addEventListener('click', () => checkAnswer(answerInput));
    
    // Append all elements
    actionDiv.appendChild(revealBtn);
    actionDiv.appendChild(checkBtn);
    
    questionDiv.appendChild(questionTextP);
    questionDiv.appendChild(answerInput);
    questionDiv.appendChild(actionDiv);
    
    // Create result element (hidden initially)
    const resultDiv = document.createElement('div');
    resultDiv.className = 'answer-result hidden';
    questionDiv.appendChild(resultDiv);
    
    return questionDiv;
}

function handleRevealHint(event) {
    // Clear previous highlights
    clearHighlights();
    
    const sourceSentence = event.target.dataset.sourceSentence;
    if (!sourceSentence) return;
    
    // Find the sentence in the passage and highlight it
    const passageText = passageElement.textContent;
    if (passageText.includes(sourceSentence)) {
        // We need to create a new HTML structure to highlight the text
        const beforeText = passageText.substring(0, passageText.indexOf(sourceSentence));
        const afterText = passageText.substring(passageText.indexOf(sourceSentence) + sourceSentence.length);
        
        // Create the new HTML
        passageElement.innerHTML = `
            ${beforeText}<span class="highlight">${sourceSentence}</span>${afterText}
        `;
        
        // Store the active highlight reference
        activeHighlight = passageElement.querySelector('.highlight');
        
        // Scroll the highlighted text into view
        activeHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearHighlights() {
    if (activeHighlight) {
        // Restore original passage text
        passageElement.textContent = currentPracticeSet.passage;
        activeHighlight = null;
    }
}

function handleAnswerInput(event) {
    const input = event.target;
    const resultDiv = input.parentElement.querySelector('.answer-result');
    
    // Hide the result when the user starts typing again
    resultDiv.classList.add('hidden');
}

function checkAnswer(inputElement) {
    const userAnswer = inputElement.value.trim().toLowerCase();
    const correctAnswer = inputElement.dataset.correctAnswer.toLowerCase();
    
    const resultDiv = inputElement.parentElement.querySelector('.answer-result');
    
    // Compare the answers
    if (userAnswer === correctAnswer) {
        resultDiv.textContent = '✓ Correct!';
        resultDiv.className = 'answer-result correct';
    } else {
        resultDiv.textContent = '✗ Incorrect. Try again.';
        resultDiv.className = 'answer-result incorrect';
    }
    
    // Show the result
    resultDiv.classList.remove('hidden');
}

async function handleWordClick(event) {
    // Only translate if the user clicks on text, not on other elements
    if (event.target === passageElement || event.target.className === 'highlight') {
        // Get the text selection
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // Only proceed if text is selected
        if (selectedText && selectedText.length > 0 && selectedText.length < 30) {
            // Show loading state
            translatedWordElement.textContent = 'Translating...';
            positionTranslationModal(event);
            
            try {
                // Make API request for translation
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ word: selectedText })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Display the translation
                translatedWordElement.textContent = `${selectedText}: ${data.translation}`;
                positionTranslationModal(event);
            } catch (error) {
                console.error('Error translating word:', error);
                translatedWordElement.textContent = 'Translation error';
            }
        }
    }
}

function positionTranslationModal(event) {
    // Position the modal exactly near the clicked word
    const selection = window.getSelection();
    
    // Get the range of the selection
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position the modal right below the selected word
        const x = rect.left;
        const y = rect.bottom;
        
        translationModal.style.display = 'block';
        translationModal.style.left = `${x}px`;
        translationModal.style.top = `${y + 5}px`;
    } else {
        // Fallback to mouse position if range not available
        const x = event.clientX;
        const y = event.clientY;
        
        translationModal.style.display = 'block';
        translationModal.style.left = `${x}px`;
        translationModal.style.top = `${y + 5}px`;
    }
}

function hideTranslationModal() {
    translationModal.style.display = 'none';
}
