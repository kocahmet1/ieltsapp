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
const mhTab = document.getElementById('mhTab'); // Matching Headings Tab
const fitbQuestions = document.getElementById('fitbQuestions');
const tfngQuestions = document.getElementById('tfngQuestions');
const tfngQuestionsContainer = document.getElementById('tfngQuestionsContainer');
const mhQuestions = document.getElementById('mhQuestions'); // Matching Headings Content Area

// Matching Headings Specific Elements
const mhHeadingsList = document.getElementById('mhHeadingsList');
const mhQuestionArea = document.getElementById('mhQuestionArea');
const mhCheckAnswersBtn = document.getElementById('mhCheckAnswersBtn');
const mhResults = document.getElementById('mhResults');

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
let G_currentUserData = null; // Global variable for current user session data

// Auth Form Elements (Registration)
const registrationSection = document.getElementById('registrationSection'); // To show/hide
const registerForm = document.getElementById('registerForm');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerMessage = document.getElementById('registerMessage');

// Auth Form Elements (Login)
const loginSection = document.getElementById('loginSection'); // To show/hide
const loginForm = document.getElementById('loginForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginMessage = document.getElementById('loginMessage');

// Auth Navigation Elements
const authNav = document.getElementById('authNav'); // The nav container itself
const loginNavBtn = document.getElementById('loginNavBtn');
const registerNavBtn = document.getElementById('registerNavBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');
const progressNavBtn = document.getElementById('progressNavBtn');
const logoutNavBtn = document.getElementById('logoutNavBtn');

// Progress Display Elements
const progressSection = document.getElementById('progressSection');
const progressTableBody = document.getElementById('progressTableBody');
const noProgressMessage = document.getElementById('noProgressMessage');


// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
if (generateBtn) generateBtn.addEventListener('click', generatePracticeSet); // Ensure button exists
if (closeTranslationBtn) closeTranslationBtn.addEventListener('click', hideTranslationModal);

// Tab switching event listeners
if (fitbTab) fitbTab.addEventListener('click', () => switchTab('fitb'));
if (tfngTab) tfngTab.addEventListener('click', () => switchTab('tfng'));
if (mhTab) mhTab.addEventListener('click', () => switchTab('mh')); // Event listener for MH Tab

// API Key event listeners
if (apiKeyToggleBtn) apiKeyToggleBtn.addEventListener('click', toggleApiKeySection);
if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);

// Registration Form Event Listener
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value.trim();
        registerMessage.textContent = '';
        registerMessage.className = 'auth-message';


        if (!username || !password) {
            registerMessage.textContent = 'Please fill in all fields.';
            registerMessage.classList.add('error'); // Optional: for styling error messages
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                registerMessage.textContent = data.message;
                registerMessage.classList.remove('error');
                registerMessage.classList.add('success'); // Optional: for styling success messages
                registerForm.reset();
                // Optionally hide the form or redirect after a short delay
                // setTimeout(() => { registrationSection.style.display = 'none'; }, 2000);
            } else {
                registerMessage.textContent = 'Error: ' + (data.message || response.statusText);
                registerMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Registration request failed:', error);
            registerMessage.textContent = 'Registration request failed. Please try again later.';
            registerMessage.classList.add('error');
        }
    });
}


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
    if (passageElement) passageElement.addEventListener('click', handleWordClick);
    
    // Load saved API key if exists
    loadSavedApiKey();

    // Example: Show registration form (remove this in final implementation, use nav links)
    // if(registrationSection) registrationSection.style.display = 'block'; 
    checkLoginStatus(); // Check login status on page load
}

// --- Auth UI and Logic ---
function updateAuthStateUI(data) {
    G_currentUserData = data; // Store user data globally

    if (!loginNavBtn || !registerNavBtn || !logoutNavBtn || !progressNavBtn || !currentUserDisplay || !loginSection || !registrationSection) {
        console.warn("Auth UI elements not fully available on this page.");
        if(authNav) authNav.style.display = 'block'; 
        return;
    }
    
    authNav.style.display = 'block'; 

    if (data && data.isLoggedIn) {
        loginNavBtn.style.display = 'none';
        registerNavBtn.style.display = 'none';
        loginSection.style.display = 'none';
        registrationSection.style.display = 'none';

        logoutNavBtn.style.display = 'inline-block';
        progressNavBtn.style.display = 'inline-block'; 
        currentUserDisplay.textContent = 'Welcome, ' + data.user.username;
        currentUserDisplay.style.display = 'inline-block';
    } else {
        G_currentUserData = { isLoggedIn: false }; // Ensure G_currentUserData reflects logged out state
        loginNavBtn.style.display = 'inline-block';
        registerNavBtn.style.display = 'inline-block';
        
        logoutNavBtn.style.display = 'none';
        progressNavBtn.style.display = 'none'; 
        currentUserDisplay.style.display = 'none';
        if (progressSection) progressSection.style.display = 'none'; // Hide progress section on logout

        loginSection.style.display = 'none';
        registrationSection.style.display = 'none';
    }
}

async function checkLoginStatus() {
    try {
        const response = await fetch('/api/current_user');
        if (!response.ok) { // Handle non-OK responses that are not network errors
            console.error('Failed to fetch login status:', response.status, response.statusText);
            updateAuthStateUI({ isLoggedIn: false }); // Assume logged out
            return;
        }
        const data = await response.json();
        updateAuthStateUI(data);
    } catch (error) {
        console.error('Error fetching login status (network or parsing error):', error);
        updateAuthStateUI({ isLoggedIn: false }); // Assume logged out
    }
}

if (loginNavBtn) {
    loginNavBtn.addEventListener('click', () => {
        if (loginSection) loginSection.style.display = 'block';
        if (registrationSection) registrationSection.style.display = 'none';
        if (progressSection) progressSection.style.display = 'none';
        if (practiceArea) practiceArea.classList.add('hidden'); // Hide practice area
        if (apiKeySection) apiKeySection.classList.add('hidden');
        if (loginMessage) loginMessage.textContent = ''; 
    });
}

if (registerNavBtn) {
    registerNavBtn.addEventListener('click', () => {
        if (registrationSection) registrationSection.style.display = 'block';
        if (loginSection) loginSection.style.display = 'none';
        if (progressSection) progressSection.style.display = 'none';
        if (practiceArea) practiceArea.classList.add('hidden');  // Hide practice area
        if (apiKeySection) apiKeySection.classList.add('hidden');
        if (registerMessage) registerMessage.textContent = ''; 
    });
}

if (progressNavBtn) {
    progressNavBtn.addEventListener('click', () => {
        if (progressSection) progressSection.style.display = 'block';
        if (loginSection) loginSection.style.display = 'none';
        if (registrationSection) registrationSection.style.display = 'none';
        if (practiceArea) practiceArea.classList.add('hidden'); // Hide practice area
        if (apiKeySection) apiKeySection.classList.add('hidden');
        fetchAndDisplayProgress();
    });
}


if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        loginMessage.textContent = '';
        loginMessage.className = 'auth-message';

        if (!username || !password) {
            loginMessage.textContent = 'Please fill in all fields.';
            loginMessage.classList.add('error');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                loginMessage.textContent = data.message;
                loginMessage.classList.add('success');
                loginForm.reset();
                await checkLoginStatus(); // Update UI based on new login state
                if (loginSection) loginSection.style.display = 'none'; // Hide form on success
            } else {
                loginMessage.textContent = 'Error: ' + (data.message || response.statusText);
                loginMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Login request failed:', error);
            loginMessage.textContent = 'Login request failed. Please try again later.';
            loginMessage.classList.add('error');
        }
    });
}

if (logoutNavBtn) {
    logoutNavBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                await checkLoginStatus(); // Update UI based on new logout state
            } else {
                const data = await response.json();
                console.error('Logout failed:', data.message || response.statusText);
                alert('Logout failed. Please try again.'); // Simple alert for now
            }
        } catch (error) {
            console.error('Logout request failed:', error);
            alert('Logout request failed. Please try again.');
        }
    });
}
// --- End Auth UI and Logic ---

// --- Progress Display Function ---
async function fetchAndDisplayProgress() {
    if (!progressTableBody || !noProgressMessage) {
        console.error('Progress display elements not found.');
        return;
    }

    progressTableBody.innerHTML = ''; // Clear previous progress
    noProgressMessage.style.display = 'none'; // Hide no progress message

    try {
        const response = await fetch('/api/get_progress');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error message from backend
            throw new Error(`Failed to fetch progress: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
        }
        const progressRecords = await response.json();

        if (progressRecords.length === 0) {
            noProgressMessage.style.display = 'block';
        } else {
            progressRecords.forEach(record => {
                const row = progressTableBody.insertRow();
                row.insertCell().textContent = record.date_attempted || '-';
                row.insertCell().textContent = record.practice_set_id || '-';
                row.insertCell().textContent = record.score_fitb || '-';
                row.insertCell().textContent = record.score_tfng || '-';
                row.insertCell().textContent = record.score_mh || '-';
            });
        }
    } catch (error) {
        console.error('Error fetching or displaying progress:', error);
        progressTableBody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Failed to load progress. ${error.message}</td></tr>`;
    }
}
// --- End Progress Display Function ---


function toggleApiKeySection() {
    if (apiKeySection) {
        apiKeySection.classList.toggle('hidden');
        if (!apiKeySection.classList.contains('hidden')) {
            if (apiKeyInput) apiKeyInput.focus();
        }
    }
}

function loadSavedApiKey() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (apiKeyInput && apiKeyStatus) { // Ensure elements exist
        const savedKey = localStorage.getItem('geminiApiKey');
        if (savedKey) {
            apiKeyInput.value = ''; // Don't display the actual key
            apiKeyStatus.textContent = 'Custom API key is set and will be used.';
            apiKeyStatus.className = 'api-key-status success';
        } else {
            apiKeyStatus.textContent = 'No custom API key saved. The app will use its default key.';
            apiKeyStatus.className = 'api-key-status';
        }
    }
}

function saveApiKey() {
    if (apiKeyInput && apiKeyStatus && apiKeySection) { // Ensure elements exist
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            localStorage.removeItem('geminiApiKey');
            apiKeyStatus.textContent = 'API key removed. The app will use its default key.';
            apiKeyStatus.className = 'api-key-status';
            return;
        }
        
        if (apiKey.length < 30) { // Basic validation
            apiKeyStatus.textContent = 'Error: The key appears to be invalid. Please check and try again.';
            apiKeyStatus.className = 'api-key-status error';
            return;
        }
        
        localStorage.setItem('geminiApiKey', apiKey);
        apiKeyInput.value = '';
        apiKeyStatus.textContent = 'Custom API key saved successfully!';
        apiKeyStatus.className = 'api-key-status success';
        
        setTimeout(() => {
            apiKeySection.classList.add('hidden');
        }, 2000);
    }
}

function switchTab(tabName) {
    // Deactivate all tabs and content
    [fitbTab, tfngTab, mhTab].forEach(tab => tab && tab.classList.remove('active'));
    [fitbQuestions, tfngQuestions, mhQuestions].forEach(content => content && content.classList.remove('active'));

    // Activate selected tab and content
    if (tabName === 'fitb' && fitbTab && fitbQuestions) {
        fitbTab.classList.add('active');
        fitbQuestions.classList.add('active');
    } else if (tabName === 'tfng' && tfngTab && tfngQuestions) {
        tfngTab.classList.add('active');
        tfngQuestions.classList.add('active');
    } else if (tabName === 'mh' && mhTab && mhQuestions) {
        mhTab.classList.add('active');
        mhQuestions.classList.add('active');
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

// Poll interval in milliseconds
const POLL_INTERVAL = 2000;  // 2 seconds
const MAX_POLL_TIME = 180000; // 3 minutes

async function generatePracticeSet() {
    try {
        // Show loading indicator
        loadingIndicator.classList.remove('hidden');
        loadingIndicator.innerHTML = '<p>Starting generation process...</p>';
        generateBtn.disabled = true;
        
        // Clear any existing highlights
        clearHighlights();
        
        // Get the custom API key if it exists
        const customApiKey = localStorage.getItem('geminiApiKey');
        
        // Step 1: Start the background job
        const startResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: customApiKey || '',
                question_type: 'matching_headings' // Reverted to matching_headings
            })
        });
        
        if (!startResponse.ok) {
            throw new Error(`Failed to start generation process: ${startResponse.status}`);
        }
        
        const jobData = await startResponse.json();
        const jobId = jobData.job_id;
        
        if (!jobId) {
            throw new Error('No job ID returned from server');
        }
        
        // Step 2: Poll for job completion
        loadingIndicator.innerHTML = `
            <p>Generating practice set...</p>
            <p class="small">This may take up to 3 minutes. The app is generating high-quality IELTS content.</p>
            <div class="progress-container">
                <div class="progress-bar" id="progressBar"></div>
            </div>
        `;
        
        const progressBar = document.getElementById('progressBar');
        let elapsedTime = 0;
        
        // Start polling for job status
        const practiceSet = await pollJobStatus(jobId, async (progress) => {
            // Update progress indicator
            elapsedTime += POLL_INTERVAL;
            const percentage = Math.min((elapsedTime / MAX_POLL_TIME) * 100, 100);
            progressBar.style.width = `${percentage}%`;
            
            // Update message every 10 seconds
            if (elapsedTime % 10000 === 0) {
                const timeElapsed = Math.floor(elapsedTime / 1000);
                loadingIndicator.innerHTML = `
                    <p>Still working... (${timeElapsed}s elapsed)</p>
                    <p class="small">Creating a high-quality IELTS practice set with reading passage and questions.</p>
                    <div class="progress-container">
                        <div class="progress-bar" id="progressBar" style="width:${percentage}%"></div>
                    </div>
                `;
            }
        });
        
        // Successfully received practice set
        if (practiceSet) {
            currentPracticeSet = practiceSet;
            currentPracticeId = practiceSet.id;
            displayPracticeSet(practiceSet);
        } else {
            throw new Error('Failed to generate practice set after 3 minutes');
        }
    } catch (error) {
        console.error('Error generating practice set:', error);
        
        // Clear the practice area if there was an error
        practiceArea.innerHTML = `
            <div class="error-message">
                <h3>Error generating practice set</h3>
                <p>${error.message || 'There was a problem connecting to the server. Please try again later.'}</p>
                <p>Try again by clicking the 'Generate New Practice Set' button.</p>
            </div>
        `;
    } finally {
        // Hide loading indicator
        loadingIndicator.classList.add('hidden');
        loadingIndicator.innerHTML = '';
        generateBtn.disabled = false;
    }
}

async function pollJobStatus(jobId, progressCallback) {
    const startTime = Date.now();
    
    // Keep polling until we reach MAX_POLL_TIME
    while (Date.now() - startTime < MAX_POLL_TIME) {
        try {
            // Call progress callback to update UI
            if (progressCallback) {
                progressCallback((Date.now() - startTime) / MAX_POLL_TIME);
            }
            
            // Check job status
            const response = await fetch(`/api/job-status?job_id=${jobId}`);
            
            if (!response.ok) {
                console.error(`Error checking job status: ${response.status}`);
                // Continue polling despite error
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
                continue;
            }
            
            const data = await response.json();
            
            // Check job status
            if (data.status === 'completed') {
                // Job completed successfully
                return data.practice_set;
            } else if (data.status === 'failed') {
                // Job failed
                throw new Error(data.error || 'Job failed without specific error message');
            }
            
            // If job is still pending, wait before polling again
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        } catch (error) {
            console.error('Error polling job status:', error);
            // Wait before trying again
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
    }
    
    // If we've reached here, we timed out
    return null;
}

function displayPracticeSet(practiceSet) {
function displayPracticeSet(practiceSet) {
    currentPracticeSet = practiceSet; // Store the full practice set globally

    if (!practiceSet || !practiceSet.passage) {
        console.error('Invalid practice set data: Missing passage.', practiceSet);
        practiceArea.innerHTML = `<div class="error-message"><h3>Error</h3><p>Invalid practice set data received.</p></div>`;
        loadingIndicator.classList.add('hidden');
        return;
    }

    console.log('Displaying Practice Set:', JSON.stringify(practiceSet, null, 2));

    // Clear previous content
    passageElement.innerHTML = ''; // Clear passage
    questionsElement.innerHTML = ''; // Clear FITB questions
    tfngQuestionsContainer.innerHTML = ''; // Clear TFNG questions
    if (mhHeadingsList) mhHeadingsList.innerHTML = ''; // Clear MH headings
    if (mhQuestionArea) mhQuestionArea.innerHTML = ''; // Clear MH question area
    if (mhResults) {
        mhResults.innerHTML = ''; // Clear MH results
        mhResults.classList.add('hidden');
    }
    
    // Always display the passage
    passageElement.textContent = practiceSet.passage;

    const questionType = practiceSet.question_type;

    if (questionType === 'matching_headings') {
        if (!practiceSet.paragraphs || !practiceSet.headings || !practiceSet.answers) {
            console.error('Invalid Matching Headings data:', practiceSet);
            practiceArea.innerHTML = `<div class="error-message"><h3>Error</h3><p>Invalid Matching Headings data received.</p></div>`;
            return;
        }
        displayMHContent(practiceSet);
        switchTab('mh');
    } else if (questionType === 'mixed_fitb_tfng' || (!questionType && practiceSet.questions)) {
        // Handle FITB/TFNG types or older data that has a 'questions' array
        if (!practiceSet.questions || !Array.isArray(practiceSet.questions)) {
             console.error('Invalid mixed_fitb_tfng data: Missing questions array.', practiceSet);
             practiceArea.innerHTML = `<div class="error-message"><h3>Error</h3><p>Invalid FITB/TFNG data received.</p></div>`;
             return;
        }
        const fitbItems = [];
        const tfngItems = [];
        
        practiceSet.questions.forEach(question => {
            if (question.question_type === 'TFNG') {
                tfngItems.push(question);
            } else if (question.question_type === 'FITB') {
                fitbItems.push(question);
            } else {
                // For older data, assume FITB if not specified
                console.warn('Question type not specified, assuming FITB:', question);
                fitbItems.push(question);
            }
        });

        fitbItems.forEach(question => {
            const questionElement = createFITBQuestionElement(question);
            questionsElement.appendChild(questionElement);
        });

        tfngItems.forEach(question => {
            const questionElement = createTFNGQuestionElement(question);
            tfngQuestionsContainer.appendChild(questionElement);
        });

        if (fitbItems.length > 0) {
            switchTab('fitb');
        } else if (tfngItems.length > 0) {
            switchTab('tfng');
        } else {
            // No questions of either type, maybe show a message or default tab
            switchTab('fitb'); // Default to FITB tab
        }
    } else {
        console.error('Unknown or invalid question_type:', questionType, practiceSet);
        practiceArea.innerHTML = `<div class="error-message"><h3>Error</h3><p>Unknown practice set format.</p></div>`;
        loadingIndicator.classList.add('hidden');
        return;
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

// --- Matching Headings Functions ---
function displayMHContent(mhData) {
    if (!mhHeadingsList || !mhQuestionArea || !passageElement) {
        console.error("MH DOM elements not found!");
        return;
    }
    // Passage is already set by displayPracticeSet
    // passageElement.textContent = mhData.passage; // Ensure passage is set

    // Render Headings List
    let headingsHtml = '<p><strong>Instructions:</strong> Match the headings below to the correct paragraphs in the passage. There are more headings than paragraphs, so you will not use them all.</p><ul>';
    mhData.headings.forEach(heading => {
        headingsHtml += `<li><strong>${heading.id}.</strong> ${heading.text}</li>`;
    });
    headingsHtml += '</ul>';
    mhHeadingsList.innerHTML = headingsHtml;

    // Render Question Area (Paragraphs with Select Dropdowns)
    mhQuestionArea.innerHTML = ''; // Clear previous
    mhData.paragraphs.forEach(paragraph => {
        const paraDiv = document.createElement('div');
        paraDiv.className = 'mh-paragraph-selection question-item'; // Added question-item for consistent styling

        const label = document.createElement('label');
        label.textContent = `Paragraph ${paragraph.id}: `;
        label.htmlFor = `select-p-${paragraph.id}`;

        const select = document.createElement('select');
        select.dataset.paragraphId = paragraph.id;
        select.id = `select-p-${paragraph.id}`;

        let optionsHtml = '<option value="">Select a heading...</option>';
        mhData.headings.forEach(heading => {
            optionsHtml += `<option value="${heading.id}">${heading.id}. ${heading.text}</option>`;
        });
        select.innerHTML = optionsHtml;
        
        // Add event listener to clear result styling on change
        select.addEventListener('change', () => {
            select.classList.remove('correct', 'incorrect');
            if(mhResults) mhResults.classList.add('hidden');
        });

        paraDiv.appendChild(label);
        paraDiv.appendChild(select);
        mhQuestionArea.appendChild(paraDiv);
    });
}

if (mhCheckAnswersBtn) {
    mhCheckAnswersBtn.addEventListener('click', () => {
        if (!currentPracticeSet || currentPracticeSet.question_type !== 'matching_headings' || !mhQuestionArea || !mhResults) {
            console.error("Cannot check MH answers: No current MH set or DOM elements missing.");
            return;
        }

        const correctAnswers = currentPracticeSet.answers;
        const paragraphsData = currentPracticeSet.paragraphs;
        let correctCount = 0;

        const selectElements = mhQuestionArea.querySelectorAll('select[data-paragraph-id]');
        
        selectElements.forEach(select => {
            const paragraphId = select.dataset.paragraphId;
            const selectedHeadingId = select.value;
            const correctAnswerId = correctAnswers[paragraphId];

            select.classList.remove('correct', 'incorrect'); // Reset classes

            if (selectedHeadingId === correctAnswerId) {
                correctCount++;
                select.classList.add('correct');
            } else if (selectedHeadingId !== "") {
                select.classList.add('incorrect');
            }
        });

        mhResults.textContent = `You matched ${correctCount} out of ${paragraphsData.length} headings correctly.`;
        mhResults.className = 'mh-results answer-result'; 
        mhResults.classList.remove('hidden');
        
        // Save MH progress
        saveUserProgress('mh', `${correctCount}/${paragraphsData.length}`);
    });
}

// --- Function to Save User Progress ---
async function saveUserProgress(questionType, scoreString) {
    if (!G_currentUserData || !G_currentUserData.isLoggedIn) {
        console.log('User not logged in. Progress not saved.');
        return;
    }
    if (!currentPracticeId) {
        console.error('No current practice set ID available to save progress.');
        return;
    }

    const payload = {
        practice_set_id: currentPracticeId 
    };

    if (questionType === 'fitb') payload.score_fitb = scoreString;
    if (questionType === 'tfng') payload.score_tfng = scoreString;
    if (questionType === 'mh') payload.score_mh = scoreString;

    try {
        const response = await fetch('/api/save_progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            console.log('Progress saved:', data.message);
            // Optionally, display a small success message to the user on the UI
        } else {
            console.error('Failed to save progress:', data.message || response.statusText);
        }
    } catch (error) {
        console.error('Error saving progress (network):', error);
    }
}
// --- End Matching Headings Functions ---


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
    answerInput.addEventListener('input', (event) => handleAnswerInput(event.target));
    
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

function handleAnswerInput(inputElement) {
    // const input = event.target;
    const resultDiv = inputElement.parentElement.querySelector('.answer-result');
    
    // Hide the result when the user starts typing again
    if (resultDiv) {
        resultDiv.classList.add('hidden');
    }
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
