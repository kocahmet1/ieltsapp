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

// Tab Elements
const fitbTab = document.getElementById('fitbTab');
const tfngTab = document.getElementById('tfngTab');
const fitbQuestions = document.getElementById('fitbQuestions');
const tfngQuestions = document.getElementById('tfngQuestions');
const tfngQuestionsContainer = document.getElementById('tfngQuestionsContainer');

// API Key Elements
const apiKeyToggleBtn = document.getElementById('apiKeyToggleBtn');
const apiKeySection = document.getElementById('apiKeySection');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// Current practice set data
let currentPracticeSet = null;
let activeHighlight = null;
let currentPracticeId = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
generateBtn.addEventListener('click', generatePracticeSet);
closeTranslationBtn.addEventListener('click', hideTranslationModal);

// Tab switching event listeners
fitbTab.addEventListener('click', () => switchTab('fitb'));
tfngTab.addEventListener('click', () => switchTab('tfng'));

// API Key event listeners
apiKeyToggleBtn.addEventListener('click', toggleApiKeySection);
saveApiKeyBtn.addEventListener('click', saveApiKey);

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
    
    // Load saved API key if exists
    loadSavedApiKey();
}

function toggleApiKeySection() {
    apiKeySection.classList.toggle('hidden');
    if (!apiKeySection.classList.contains('hidden')) {
        apiKeyInput.focus();
    }
}

function loadSavedApiKey() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        // Don't display the actual key for security, but show it's set
        apiKeyInput.value = '';
        apiKeyStatus.textContent = 'Custom API key is set and will be used.';
        apiKeyStatus.className = 'api-key-status success';
    } else {
        apiKeyStatus.textContent = 'No custom API key saved. The app will use its default key.';
        apiKeyStatus.className = 'api-key-status';
    }
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        // If empty, remove any saved key
        localStorage.removeItem('geminiApiKey');
        apiKeyStatus.textContent = 'API key removed. The app will use its default key.';
        apiKeyStatus.className = 'api-key-status';
        return;
    }
    
    // Basic validation - Gemini API keys are typically like 'AI...' and 43 chars
    if (apiKey.length < 30) {
        apiKeyStatus.textContent = 'Error: The key appears to be invalid. Please check and try again.';
        apiKeyStatus.className = 'api-key-status error';
        return;
    }
    
    // Save the key to localStorage
    localStorage.setItem('geminiApiKey', apiKey);
    
    // Update UI
    apiKeyInput.value = '';
    apiKeyStatus.textContent = 'Custom API key saved successfully!';
    apiKeyStatus.className = 'api-key-status success';
    
    // Hide section after successful save
    setTimeout(() => {
        apiKeySection.classList.add('hidden');
    }, 2000);
}

function switchTab(tabName) {
    // Remove active class from all tabs and tab content
    fitbTab.classList.remove('active');
    tfngTab.classList.remove('active');
    fitbQuestions.classList.remove('active');
    tfngQuestions.classList.remove('active');
    
    // Add active class to the selected tab and content
    if (tabName === 'fitb') {
        fitbTab.classList.add('active');
        fitbQuestions.classList.add('active');
    } else if (tabName === 'tfng') {
        tfngTab.classList.add('active');
        tfngQuestions.classList.add('active');
    }
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
        
        // Get the custom API key if it exists
        const customApiKey = localStorage.getItem('geminiApiKey');
        
        // Make API request to generate new practice set
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: customApiKey || ''
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        currentPracticeSet = data;
        currentPracticeId = data.id; // Store the ID for future reference
        
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
    
    // Debug: Log the practice set data to see its structure
    console.log('Practice set data:', JSON.stringify(practiceSet, null, 2));
    
    // Display the passage
    passageElement.textContent = practiceSet.passage;
    
    // Clear both question containers
    questionsElement.innerHTML = '';
    tfngQuestionsContainer.innerHTML = '';
    
    // Separate questions by type
    const fitbQuestions = [];
    const tfngQuestions = [];
    
    practiceSet.questions.forEach(question => {
        if (question.question_type === 'TFNG') {
            tfngQuestions.push(question);
        } else {
            // Default to FITB for backward compatibility
            fitbQuestions.push(question);
        }
    });
    
    // Display FITB questions
    fitbQuestions.forEach(question => {
        const questionElement = createFITBQuestionElement(question);
        questionsElement.appendChild(questionElement);
    });
    
    // Display TFNG questions
    tfngQuestions.forEach(question => {
        const questionElement = createTFNGQuestionElement(question);
        tfngQuestionsContainer.appendChild(questionElement);
    });
    
    // Show the appropriate tab based on which has questions
    if (fitbQuestions.length > 0) {
        switchTab('fitb');
    } else if (tfngQuestions.length > 0) {
        switchTab('tfng');
    }
    
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

function createFITBQuestionElement(question) {
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

function createTFNGQuestionElement(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.dataset.questionId = question.id;
    
    // Create statement text
    const statementP = document.createElement('p');
    statementP.className = 'question-text';
    statementP.textContent = question.statement;
    
    // Create options for True/False/Not Given
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'tfng-options';
    
    const options = ['True', 'False', 'Not Given'];
    const correctAnswer = question.answer;
    
    options.forEach(option => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'tfng-option';
        optionBtn.textContent = option;
        optionBtn.dataset.value = option;
        
        // Add click event for selecting this option
        optionBtn.addEventListener('click', (e) => {
            // Remove selected class from all options
            const allOptions = optionsDiv.querySelectorAll('.tfng-option');
            allOptions.forEach(opt => {
                opt.classList.remove('selected', 'correct', 'incorrect');
            });
            
            // Add selected class to this option
            optionBtn.classList.add('selected');
            
            // Check if correct
            if (option === correctAnswer) {
                optionBtn.classList.add('correct');
                resultDiv.textContent = '✓ Correct!';
                resultDiv.className = 'answer-result correct';
            } else {
                optionBtn.classList.add('incorrect');
                resultDiv.textContent = '✗ Incorrect. The answer is ' + correctAnswer + '.';
                resultDiv.className = 'answer-result incorrect';
            }
            
            // Show the result
            resultDiv.classList.remove('hidden');
        });
        
        optionsDiv.appendChild(optionBtn);
    });
    
    // Create action buttons
    const actionDiv = document.createElement('div');
    actionDiv.className = 'question-actions';
    
    // Create highlight passage button if relevant_passage exists
    if (question.relevant_passage) {
        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'btn secondary';
        highlightBtn.textContent = 'Highlight Passage';
        highlightBtn.dataset.relevantPassage = question.relevant_passage;
        highlightBtn.addEventListener('click', handleHighlightPassage);
        
        actionDiv.appendChild(highlightBtn);
    }
    
    // Create result element (hidden initially)
    const resultDiv = document.createElement('div');
    resultDiv.className = 'answer-result hidden';
    
    // Append elements to question div
    questionDiv.appendChild(statementP);
    questionDiv.appendChild(optionsDiv);
    questionDiv.appendChild(actionDiv);
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

function handleHighlightPassage(event) {
    // Clear previous highlights
    clearHighlights();
    
    const relevantPassage = event.target.dataset.relevantPassage;
    if (!relevantPassage) {
        console.log('No relevant passage found in the dataset');
        return;
    }
    
    console.log('Trying to highlight:', relevantPassage);
    
    // Find the relevant passage and highlight it
    const passageText = passageElement.textContent;
    
    // First try exact matching
    if (passageText.includes(relevantPassage)) {
        highlightText(relevantPassage);
        return;
    }
    
    // If exact match fails, try to find the best match
    // Sometimes the AI might generate slightly different text than what's in the passage
    console.log('No exact match found, trying fuzzy matching');
    
    // Try finding a sentence that contains most of the words
    const relevantWords = relevantPassage.split(/\s+/).filter(word => word.length > 4);
    const sentences = passageText.split(/[.!?]\s+/);
    
    let bestSentence = '';
    let maxMatches = 0;
    
    sentences.forEach(sentence => {
        let matchCount = 0;
        relevantWords.forEach(word => {
            if (sentence.toLowerCase().includes(word.toLowerCase())) {
                matchCount++;
            }
        });
        
        if (matchCount > maxMatches && matchCount >= Math.min(3, relevantWords.length / 2)) {
            maxMatches = matchCount;
            bestSentence = sentence;
        }
    });
    
    if (bestSentence) {
        console.log('Found best matching sentence:', bestSentence);
        highlightText(bestSentence);
    } else {
        console.log('Could not find a good match for:', relevantPassage);
        // As a fallback, just try the first 100 characters of the relevant passage
        const shortPassage = relevantPassage.substring(0, 100);
        if (passageText.includes(shortPassage)) {
            highlightText(shortPassage);
        }
    }
}

function highlightText(text) {
    const passageText = passageElement.textContent;
    const index = passageText.indexOf(text);
    
    if (index !== -1) {
        const beforeText = passageText.substring(0, index);
        const afterText = passageText.substring(index + text.length);
        
        // Create the new HTML
        passageElement.innerHTML = `
            ${beforeText}<span class="highlight">${text}</span>${afterText}
        `;
        
        // Store the active highlight reference
        activeHighlight = passageElement.querySelector('.highlight');
        
        // Scroll the highlighted text into view
        activeHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }
    return false;
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
                // Get the custom API key if it exists
                const customApiKey = localStorage.getItem('geminiApiKey');
                
                // Make API request for translation
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        word: selectedText,
                        apiKey: customApiKey || ''
                    })
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
