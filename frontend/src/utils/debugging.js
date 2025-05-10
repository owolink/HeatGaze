// Debugging utilities for HeatGaze frontend

/**
 * Tests cursor API endpoints to verify connectivity
 * @param {string} sessionId - The ID of the session to test
 * @param {string} token - Authentication token 
 * @returns {Promise<object>} Test results
 */
export const testCursorEndpoints = async (sessionId, token) => {
    const results = {
        status: 'running',
        errors: [],
        steps: []
    };

    try {
        // Step 1: Verify we can fetch an existing session
        try {
            const fetchResponse = await fetch(`/api/sessions/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch session: ${fetchResponse.status}`);
            }
            
            const sessionData = await fetchResponse.json();
            results.steps.push({
                name: 'Fetch session',
                success: true,
                message: `Successfully fetched session: ${sessionData.name}`
            });
            
        } catch (error) {
            results.steps.push({
                name: 'Fetch session',
                success: false,
                message: error.message
            });
            results.errors.push(`Session fetch failed: ${error.message}`);
        }
        
        // Step 2: Test sending a single cursor point
        try {
            const singlePoint = [{
                x: 100,
                y: 100,
                timestamp: Date.now()
            }];
            
            const singleResponse = await fetch(`/api/sessions/${sessionId}/cursor/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(singlePoint)
            });
            
            if (!singleResponse.ok) {
                throw new Error(`Failed to send cursor point: ${singleResponse.status}`);
            }
            
            const singleResult = await singleResponse.json();
            results.steps.push({
                name: 'Send single cursor point',
                success: true,
                message: `Successfully sent point: ${JSON.stringify(singleResult)}`
            });
            
        } catch (error) {
            results.steps.push({
                name: 'Send single cursor point',
                success: false,
                message: error.message
            });
            results.errors.push(`Single cursor point test failed: ${error.message}`);
        }
        
        // Step 3: Test sending a batch of cursor points
        try {
            const batchPoints = [];
            const now = Date.now();
            
            // Create 5 test points
            for (let i = 0; i < 5; i++) {
                batchPoints.push({
                    x: 200 + (i * 10),
                    y: 200 + (i * 5),
                    timestamp: now + (i * 100)
                });
            }
            
            const batchResponse = await fetch(`/api/sessions/${sessionId}/cursor/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(batchPoints)
            });
            
            if (!batchResponse.ok) {
                throw new Error(`Failed to send cursor batch: ${batchResponse.status}`);
            }
            
            const batchResult = await batchResponse.json();
            results.steps.push({
                name: 'Send cursor batch',
                success: true,
                message: `Successfully sent batch: ${JSON.stringify(batchResult)}`
            });
            
        } catch (error) {
            results.steps.push({
                name: 'Send cursor batch',
                success: false,
                message: error.message
            });
            results.errors.push(`Cursor batch test failed: ${error.message}`);
        }
        
        // Step 4: Verify we can retrieve cursor data
        try {
            const retrieveResponse = await fetch(`/api/sessions/${sessionId}/cursor`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!retrieveResponse.ok) {
                throw new Error(`Failed to retrieve cursor data: ${retrieveResponse.status}`);
            }
            
            const cursorData = await retrieveResponse.json();
            results.steps.push({
                name: 'Retrieve cursor data',
                success: true,
                message: `Successfully retrieved ${cursorData.points?.length || 0} cursor points`
            });
            
        } catch (error) {
            results.steps.push({
                name: 'Retrieve cursor data',
                success: false,
                message: error.message
            });
            results.errors.push(`Cursor data retrieval failed: ${error.message}`);
        }
        
        // Overall status
        results.status = results.errors.length === 0 ? 'success' : 'failed';
        
    } catch (error) {
        results.status = 'error';
        results.errors.push(`Overall test failed: ${error.message}`);
    }
    
    return results;
};

/**
 * Display cursor data in the console for debugging
 * @param {string} sessionId - The ID of the session to inspect
 * @param {string} token - Authentication token 
 */
export const inspectCursorData = async (sessionId, token) => {
    try {
        const response = await fetch(`/api/sessions/${sessionId}/cursor`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            console.error(`Failed to fetch cursor data: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        
        console.group(`Cursor Data Inspection for Session ${sessionId}`);
        console.log(`Total points: ${data.total}`);
        console.log(`Points in current page: ${data.points?.length || 0}`);
        
        if (data.points && data.points.length > 0) {
            console.log('First point timestamp:', new Date(data.points[0].timestamp).toLocaleString());
            console.log('Last point timestamp:', new Date(data.points[data.points.length-1].timestamp).toLocaleString());
            
            console.group('Sample Points');
            data.points.slice(0, 5).forEach((point, index) => {
                console.log(`Point ${index}:`, point);
            });
            console.groupEnd();
            
            // Create a simple visualization
            console.log('%c Cursor Points Distribution ', 'background: #3498db; color: white; font-size: 16px;');
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 150;
            const ctx = canvas.getContext('2d');
            
            // Fill background
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw points
            ctx.fillStyle = '#e74c3c';
            data.points.forEach(point => {
                const x = (point.x / window.innerWidth) * canvas.width;
                const y = (point.y / window.innerHeight) * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Output as image
            console.log('%c ', `
                font-size: 0;
                padding: ${canvas.height}px ${canvas.width}px;
                background-image: url(${canvas.toDataURL()});
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
            `);
        } else {
            console.warn('No cursor points found for this session');
        }
        
        console.groupEnd();
        
    } catch (error) {
        console.error('Error inspecting cursor data:', error);
    }
};

// Export debugging module
export default {
    testCursorEndpoints,
    inspectCursorData
}; 