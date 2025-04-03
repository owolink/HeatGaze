// Main JavaScript for HeatGaze application

// DOM Elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const demoSite = document.getElementById('demoSite');
const calibration = document.getElementById('calibration');
const heatmapViewer = document.getElementById('heatmapViewer');
const heatmapAnalysis = document.getElementById('heatmapAnalysis');
const takeScreenshotButton = document.getElementById('takeScreenshot');
const screenshotsGrid = document.getElementById('screenshotsGrid');
const analyzeButton = document.getElementById('analyzeButton');
const videoPlayer = document.getElementById('videoPlayer');
const currentHeatmap = document.getElementById('currentHeatmap');
const statsResult = document.getElementById('statsResult');
const demoFrame = document.getElementById('demoFrame');

// State
let currentSession = null;
let gazeData = [];
let screenshots = [];
let currentScreenshotId = null;
let isRecording = false;
let isCalibrating = false;
let isPlaying = false;
let playbackInterval = null;
let currentPlaybackIndex = 0;

// Register the demo origin with GazeCloud 
// (will need to be done on your actual server)
// This is just for demonstration purposes
// window.addEventListener('load', () => {
//     fetch('https://api.gazerecorder.com/register/', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             origin: window.location.origin
//         })
//     });
// });

// Event Listeners
startButton.addEventListener('click', startTracking);
stopButton.addEventListener('click', stopTracking);
takeScreenshotButton.addEventListener('click', takeScreenshot);
analyzeButton.addEventListener('click', showAnalysis);

// Configure GazeCloud API
// These are now configured in the window.addEventListener("load") block at the bottom
// GazeCloudAPI.OnResult = handleGazeData;
// GazeCloudAPI.OnCalibrationComplete = handleCalibrationComplete;
// GazeCloudAPI.OnCamDenied = handleCamDenied;
// GazeCloudAPI.OnError = handleError;
// GazeCloudAPI.UseClickRecalibration = true;

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        applyFilter(e.target.dataset.filter);
    });
});

// Main functions
async function startTracking() {
    try {
        // Get authentication token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
            // Redirect to login if no token found
            console.error('No authentication token found');
            window.location.href = '/login';
            return;
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        
        // Create a new session
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                name: `Session ${new Date().toLocaleString()}`,
                deviceInfo: navigator.userAgent
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Redirect to login if unauthorized
                console.error('Authentication error: Token expired or invalid');
                localStorage.removeItem('token'); // Clear invalid token
                window.location.href = '/login';
                return;
            }
            const errorText = await response.text();
            throw new Error(`Failed to create session: ${response.status} ${errorText}`);
        }

        currentSession = await response.json();
        gazeData = [];
        screenshots = [];
        
        // Show calibration section
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });
        calibration.style.display = 'block';
        
        // Check if GazeCloudAPI is defined
        if (typeof GazeCloudAPI === 'undefined') {
            console.error('GazeCloudAPI is not defined. Using fallback mode.');
            alert('Eye tracking API is not available. The application will run with limited functionality.');
            
            // Skip calibration and go directly to demo site
            isCalibrating = false;
            isRecording = true;
            
            document.querySelectorAll('section').forEach(section => {
                section.style.display = 'none';
            });
            demoSite.style.display = 'block';
            
            startButton.disabled = true;
            stopButton.disabled = false;
        } else {
            // Start calibration with GazeCloudAPI
            isCalibrating = true;
            try {
                GazeCloudAPI.StartEyeTracking();
            } catch (error) {
                console.error('Error starting GazeCloudAPI:', error);
                alert('Error starting eye tracking. The application will run with limited functionality.');
                
                // Skip calibration and go directly to demo site
                isCalibrating = false;
                isRecording = true;
                
                document.querySelectorAll('section').forEach(section => {
                    section.style.display = 'none';
                });
                demoSite.style.display = 'block';
            }
            startButton.disabled = true;
            stopButton.disabled = false;
        }
        
    } catch (error) {
        console.error('Error starting tracking:', error);
        alert('Ошибка при запуске отслеживания. Пожалуйста, попробуйте еще раз.');
    }
}

function stopTracking() {
    // Stop eye tracking if API is available
    if (typeof GazeCloudAPI !== 'undefined') {
        try {
            GazeCloudAPI.StopEyeTracking();
        } catch (error) {
            console.error('Error stopping GazeCloudAPI:', error);
        }
    }
    
    isRecording = false;
    stopButton.disabled = true;
    
    // End the session
    if (currentSession) {
        // Get authentication token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No authentication token found when ending session');
            window.location.href = '/login';
            return;
        }
        
        fetch(`/api/sessions/${currentSession.id}/end`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }).then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    // Redirect to login if unauthorized
                    console.error('Authentication error: Token expired or invalid');
                    localStorage.removeItem('token'); // Clear invalid token
                    window.location.href = '/login';
                    return;
                }
                console.error('Failed to end session properly');
            }
        }).catch(error => {
            console.error('Error ending session:', error);
        });
    }
    
    // Show heatmap viewer section
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    heatmapViewer.style.display = 'block';
    
    // Initialize video player
    initializePlayer();
}

function handleGazeData(gazePoint) {
    // Only record data if we're past calibration
    if (!isCalibrating && isRecording) {
        // Add gaze point to local array
        gazeData.push({
            timestamp: gazePoint.time,
            x: gazePoint.docX,
            y: gazePoint.docY,
            state: gazePoint.state,
            url: demoFrame.contentWindow.location.href
        });
        
        // If we've collected a batch of points, send them to the server
        if (gazeData.length >= 50) {
            sendGazeData();
        }
    }
}

function handleCalibrationComplete() {
    console.log('Calibration complete');
    isCalibrating = false;
    isRecording = true;
    
    // Show demo site section
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    demoSite.style.display = 'block';
    
    // Start batch sending gaze data to server periodically
    setInterval(() => {
        if (isRecording && gazeData.length > 0) {
            sendGazeData();
        }
    }, 2000);
}

function handleCamDenied() {
    alert('Доступ к камере запрещен. Пожалуйста, разрешите доступ к камере для отслеживания взгляда.');
    startButton.disabled = false;
    stopButton.disabled = true;
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    document.querySelector('.hero').style.display = 'block';
}

function handleError(msg) {
    console.error('GazeCloud Error:', msg);
    alert(`Ошибка при отслеживании взгляда: ${msg}`);
    startButton.disabled = false;
    stopButton.disabled = true;
}

async function sendGazeData() {
    if (!currentSession || gazeData.length === 0) return;
    
    const pointsToSend = [...gazeData];
    gazeData = [];
    
    try {
        // Get authentication token from localStorage if available
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Add token to headers if available
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/sessions/${currentSession.id}/gaze/batch`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(pointsToSend)
        });
        
        if (!response.ok) {
            // If failed, add the points back to the queue
            gazeData = [...pointsToSend, ...gazeData];
            console.error('Failed to send gaze data batch');
            
            if (response.status === 401) {
                // Stop recording if unauthorized
                stopTracking();
                alert('Ваша сессия истекла. Пожалуйста, войдите снова.');
                window.location.href = '/login';
            }
        }
    } catch (error) {
        // If failed, add the points back to the queue
        gazeData = [...pointsToSend, ...gazeData];
        console.error('Error sending gaze data:', error);
    }
}

function initializePlayer() {
    if (!currentSession) return;
    
    // Get the gaze data for the session
    fetch(`/api/sessions/${currentSession.id}/gaze`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                videoPlayer.innerHTML = '<p>Нет данных для отображения</p>';
                return;
            }
            
            // Sort data by timestamp
            const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
            
            // Initialize the player
            videoPlayer.innerHTML = `
                <canvas id="playbackCanvas" width="${window.innerWidth}" height="${window.innerHeight}"></canvas>
                <div class="playback-controls">
                    <button id="playPauseBtn" class="btn btn-primary">Play</button>
                    <input type="range" id="seekBar" min="0" max="${sortedData.length - 1}" value="0">
                    <span id="timeDisplay">0:00 / ${formatTime(sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp)}</span>
                </div>
            `;
            
            const canvas = document.getElementById('playbackCanvas');
            const ctx = canvas.getContext('2d');
            const playPauseBtn = document.getElementById('playPauseBtn');
            const seekBar = document.getElementById('seekBar');
            const timeDisplay = document.getElementById('timeDisplay');
            
            playPauseBtn.addEventListener('click', () => {
                if (isPlaying) {
                    pausePlayback();
                    playPauseBtn.textContent = 'Play';
                } else {
                    startPlayback(sortedData);
                    playPauseBtn.textContent = 'Pause';
                }
            });
            
            seekBar.addEventListener('input', () => {
                currentPlaybackIndex = parseInt(seekBar.value);
                drawGazePoint(ctx, sortedData[currentPlaybackIndex]);
                timeDisplay.textContent = `${formatTime(sortedData[currentPlaybackIndex].timestamp - sortedData[0].timestamp)} / ${formatTime(sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp)}`;
            });
            
            // Draw initial frame
            drawGazePoint(ctx, sortedData[0]);
        })
        .catch(error => {
            console.error('Error loading gaze data:', error);
            videoPlayer.innerHTML = '<p>Ошибка при загрузке данных</p>';
        });
}

function startPlayback(data) {
    if (isPlaying) return;
    isPlaying = true;
    
    const canvas = document.getElementById('playbackCanvas');
    const ctx = canvas.getContext('2d');
    const seekBar = document.getElementById('seekBar');
    const timeDisplay = document.getElementById('timeDisplay');
    const startTimestamp = data[0].timestamp;
    const endTimestamp = data[data.length - 1].timestamp;
    
    playbackInterval = setInterval(() => {
        if (currentPlaybackIndex < data.length - 1) {
            currentPlaybackIndex++;
            drawGazePoint(ctx, data[currentPlaybackIndex]);
            seekBar.value = currentPlaybackIndex;
            timeDisplay.textContent = `${formatTime(data[currentPlaybackIndex].timestamp - startTimestamp)} / ${formatTime(endTimestamp - startTimestamp)}`;
        } else {
            pausePlayback();
            document.getElementById('playPauseBtn').textContent = 'Replay';
            currentPlaybackIndex = 0;
        }
    }, 16); // ~60fps
}

function pausePlayback() {
    isPlaying = false;
    clearInterval(playbackInterval);
}

function drawGazePoint(ctx, point) {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Only draw valid gaze points
    if (point.state === 0) {
        // Draw gaze point
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fill();
        
        // Draw outer ring
        ctx.beginPath();
        ctx.arc(point.x, point.y, 20, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function takeScreenshot() {
    if (!currentSession) return;
    
    try {
        // Capture canvas as image
        const canvas = document.getElementById('playbackCanvas');
        if (!canvas) {
            alert('Не удалось создать скриншот. Плеер не инициализирован.');
            return;
        }
        
        const dataUrl = canvas.toDataURL('image/png');
        
        // Send screenshot to server
        const response = await fetch(`/api/sessions/${currentSession.id}/screenshots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timestamp: Date.now(),
                image_data: dataUrl,
                url: 'playback_screenshot'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save screenshot');
        }
        
        const screenshot = await response.json();
        screenshots.push(screenshot);
        
        // Add screenshot to the grid
        addScreenshotToGrid(screenshot);
        
        // Enable analyze button if there are screenshots
        if (screenshots.length > 0) {
            analyzeButton.disabled = false;
        }
        
    } catch (error) {
        console.error('Error taking screenshot:', error);
        alert('Ошибка при создании скриншота');
    }
}

function addScreenshotToGrid(screenshot) {
    const screenshotItem = document.createElement('div');
    screenshotItem.className = 'screenshot-item';
    screenshotItem.dataset.id = screenshot.id;
    
    screenshotItem.innerHTML = `
        <img src="/${screenshot.image_path}" alt="Screenshot">
    `;
    
    screenshotItem.addEventListener('click', () => {
        document.querySelectorAll('.screenshot-item').forEach(item => {
            item.classList.remove('selected');
        });
        screenshotItem.classList.add('selected');
        currentScreenshotId = screenshot.id;
    });
    
    screenshotsGrid.appendChild(screenshotItem);
}

function showAnalysis() {
    if (screenshots.length === 0) return;
    
    // Show analysis section
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    heatmapAnalysis.style.display = 'block';
    
    // If no screenshot is selected, select the first one
    if (!currentScreenshotId && screenshots.length > 0) {
        currentScreenshotId = screenshots[0].id;
    }
    
    // Apply the basic stats filter by default
    document.querySelector('.filter-btn[data-filter="basic_stats"]').classList.add('active');
    applyFilter('basic_stats');
}

async function applyFilter(filterType) {
    if (!currentScreenshotId) return;
    
    try {
        const response = await fetch(`/api/heatmap/analyze/${currentScreenshotId}?filter_type=${filterType}`);
        
        if (!response.ok) {
            throw new Error('Failed to analyze heatmap');
        }
        
        const result = await response.json();
        
        // Update the current heatmap image if available
        if (result.gradient_image) {
            currentHeatmap.src = result.gradient_image;
        } else if (result.cluster_image) {
            currentHeatmap.src = result.cluster_image;
        } else {
            // Use the original screenshot
            const screenshot = screenshots.find(s => s.id === currentScreenshotId);
            if (screenshot) {
                currentHeatmap.src = `/${screenshot.image_path}`;
            }
        }
        
        // Update the stats display
        updateStatsDisplay(result, filterType);
        
    } catch (error) {
        console.error('Error applying filter:', error);
        statsResult.innerHTML = '<p>Ошибка при анализе тепловой карты</p>';
    }
}

function updateStatsDisplay(stats, filterType) {
    statsResult.innerHTML = '';
    
    if (filterType === 'basic_stats') {
        statsResult.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Среднее значение:</span>
                <span class="stat-value">${stats.mean.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Медиана:</span>
                <span class="stat-value">${stats.median.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Стандартное отклонение:</span>
                <span class="stat-value">${stats.std_dev.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Дисперсия:</span>
                <span class="stat-value">${stats.variance.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Максимум:</span>
                <span class="stat-value">${stats.max.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Минимум:</span>
                <span class="stat-value">${stats.min.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Отношение областей высокой интенсивности:</span>
                <span class="stat-value">${(stats.high_intensity_ratio * 100).toFixed(2)}%</span>
            </div>
        `;
    } else if (filterType === 'gradient') {
        statsResult.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Средний градиент:</span>
                <span class="stat-value">${stats.mean_gradient.toFixed(4)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Максимальный градиент:</span>
                <span class="stat-value">${stats.max_gradient.toFixed(4)}</span>
            </div>
            <p class="stat-description">Градиент показывает, насколько резко меняется интенсивность просмотра между соседними областями.</p>
        `;
    } else if (filterType === 'clustering') {
        statsResult.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Количество кластеров:</span>
                <span class="stat-value">${stats.num_clusters}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Средний размер кластера:</span>
                <span class="stat-value">${stats.cluster_areas.length > 0 ? (stats.cluster_areas.reduce((a, b) => a + b, 0) / stats.cluster_areas.length).toFixed(0) : 0} пикселей</span>
            </div>
            <p class="stat-description">Кластеризация выделяет области с высокой интенсивностью просмотра.</p>
        `;
    } else if (filterType === 'correlation') {
        statsResult.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Корреляция красный-зеленый:</span>
                <span class="stat-value">${stats.correlation_red_green?.toFixed(4) || 'N/A'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Корреляция красный-синий:</span>
                <span class="stat-value">${stats.correlation_red_blue?.toFixed(4) || 'N/A'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Корреляция зеленый-синий:</span>
                <span class="stat-value">${stats.correlation_green_blue?.toFixed(4) || 'N/A'}</span>
            </div>
            <p class="stat-description">Корреляции между цветовыми каналами могут выявить интересные паттерны в тепловой карте.</p>
        `;
    }
}

function PlotGaze(GazeData) {
    // Check if GazeData is defined (might not be in fallback mode)
    if (!GazeData) {
        console.log('PlotGaze called but GazeData is undefined');
        return;
    }

    // Display gaze data
    var gazedataDiv = document.getElementById("GazeData");
    if(gazedataDiv) {
        gazedataDiv.innerHTML = "GazeX: " + GazeData.GazeX + " GazeY: " + GazeData.GazeY;
    }

    // Plot gaze position
    var x = GazeData.docX;
    var y = GazeData.docY;
    
    var gaze = document.getElementById("gaze");
    if (gaze) {
        x -= gaze.clientWidth/2;
        y -= gaze.clientHeight/2;
        gaze.style.left = x + "px";
        gaze.style.top = y + "px";

        // Show/hide gaze point based on state
        if(GazeData.state != 0) {
            if(gaze.style.display == 'block')
                gaze.style.display = 'none';
        } else {
            if(gaze.style.display == 'none')
                gaze.style.display = 'block';
        }
    }

    // Add data to our collection for batch processing
    if (currentSession && currentSession.id && !isCalibrating && isRecording) {
        // Add gaze point to local array
        gazeData.push({
            timestamp: GazeData.time,
            x: GazeData.docX,
            y: GazeData.docY,
            state: GazeData.state,
            url: demoFrame ? demoFrame.contentWindow.location.href : window.location.href
        });
        
        // If we've collected a batch of points, send them to the server
        if (gazeData.length >= 50) {
            sendGazeData();
        }
    }
}

// Use the GazeCloudAPI callbacks
window.addEventListener("load", function() {
    // Check if GazeCloudAPI is defined
    if (typeof GazeCloudAPI === 'undefined') {
        console.warn('GazeCloudAPI is not available at load time');
        return;
    }
    
    GazeCloudAPI.OnCalibrationComplete = function() { 
        console.log('Gaze Calibration Complete');
        isCalibrating = false;
        isRecording = true;
        
        // Show demo site section
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });
        demoSite.style.display = 'block';
        
        // Start batch sending gaze data to server periodically
        setInterval(() => {
            if (isRecording && gazeData.length > 0) {
                sendGazeData();
            }
        }, 2000);
        
        // Update UI to show tracking is active
        const calibrationStatus = document.getElementById('calibrationStatus');
        if (calibrationStatus) {
            calibrationStatus.textContent = 'Calibration Complete - Tracking Active';
        }
    };
    
    GazeCloudAPI.OnCamDenied = function() { 
        console.log('Camera access denied');
        alert('Camera access is required for eye tracking. Please allow camera access and refresh the page.');
        
        handleCamDenied(); // Call the original handler to maintain app state
    };
    
    GazeCloudAPI.OnError = function(msg) { 
        console.error('GazeCloudAPI Error:', msg);
        alert('Error with eye tracking: ' + msg);
        
        handleError(msg); // Call the original handler to maintain app state
    };
    
    GazeCloudAPI.UseClickRecalibration = true;
    GazeCloudAPI.OnResult = PlotGaze;
}); 