/**
 * HeatMapper - A utility for generating heatmaps based on mouse/cursor movements
 * Based on https://github.com/dcmox/heatmapper
 */

// Map of coordinate data by ID
const coordMaps = {};

/**
 * Generate a coordinate map of cursor movements
 * @param {string} mapId - ID for the map (default: 'default')
 * @param {boolean} appendToExisting - Whether to append to an existing map
 * @returns {Object} The mapping function and cleanup function
 */
export const generateCoordMap = (mapId = 'default', appendToExisting = true) => {
  // Initialize the coordMap for this ID if it doesn't exist
  if (!coordMaps[mapId] || !appendToExisting) {
    coordMaps[mapId] = [];
  }
  
  console.log(`Created coordinate map with ID: ${mapId}, length: ${coordMaps[mapId].length}`);
  
  // Add coordinate data to the map
  const addCoord = (coords) => {
    console.log(`Adding coordinate to map ${mapId}:`, coords);
    coordMaps[mapId].push(coords);
    console.log(`Map ${mapId} now has ${coordMaps[mapId].length} coordinates`);
  };
  
  // Return the map functions
  return {
    addCoord,
    getCoords: () => coordMaps[mapId],
    cleanup: () => {
      console.log(`Cleaning up map ${mapId} with ${coordMaps[mapId].length} coordinates`);
    }
  };
};

/**
 * Generate a heatmap from coordinate data
 * @param {string|HTMLElement} dest - Target element or query string
 * @param {Object} dimensions - Optional width/height constraints
 * @param {Array} mapIds - Array of map IDs to include
 * @param {string} screenSize - Screen size key
 * @returns {HTMLCanvasElement} The generated heatmap canvas
 */
export const generateHeatMap = (
  dest = null,
  dimensions = { width: window.innerWidth, height: window.innerHeight },
  mapIds = ['default'],
  screenSize = `${window.innerWidth}x${window.innerHeight}`
) => {
  // Create canvas
  const canvas = document.createElement('canvas');
  
  // Set dimensions
  if (dimensions.maxWidth && window.innerWidth > dimensions.maxWidth) {
    canvas.width = dimensions.maxWidth;
  } else if (dimensions.width) {
    canvas.width = dimensions.width;
  } else {
    canvas.width = window.innerWidth;
  }
  
  if (dimensions.maxHeight && window.innerHeight > dimensions.maxHeight) {
    canvas.height = dimensions.maxHeight;
  } else if (dimensions.height) {
    canvas.height = dimensions.height;
  } else {
    canvas.height = window.innerHeight;
  }
  
  // Get context and prepare for drawing
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Combine all requested coordinate maps
  let allCoords = [];
  mapIds.forEach(id => {
    if (coordMaps[id]) {
      allCoords = [...allCoords, ...coordMaps[id]];
    }
  });
  
  // If no coordinates, return empty canvas
  if (allCoords.length === 0) {
    if (dest) {
      renderCanvas(canvas, dest);
    }
    return canvas;
  }
  
  // Draw heatmap
  drawHeatmap(ctx, allCoords, canvas.width, canvas.height);
  
  // Render to destination if specified
  if (dest) {
    renderCanvas(canvas, dest);
  }
  
  return canvas;
};

/**
 * Draw heatmap on canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} coords - Coordinate data
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
const drawHeatmap = (ctx, coords, width, height) => {
  // Create gradient
  const intensityMap = {};
  
  // Calculate intensity for each point
  coords.forEach(coord => {
    const key = Math.floor(coord.x) + 'x' + Math.floor(coord.y);
    intensityMap[key] = (intensityMap[key] || 0) + 1;
  });
  
  // Find max intensity for normalization
  let maxIntensity = 0;
  Object.values(intensityMap).forEach(val => {
    if (val > maxIntensity) maxIntensity = val;
  });
  
  // Draw points with heat coloring
  Object.entries(intensityMap).forEach(([key, intensity]) => {
    const [x, y] = key.split('x').map(Number);
    
    // Skip if out of bounds
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    
    // Calculate normalized intensity (0-1)
    const normalizedIntensity = Math.min(intensity / maxIntensity, 1);
    
    // Draw heat point
    const radius = Math.max(5, 20 * normalizedIntensity);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    // Color based on intensity (blue -> yellow -> red)
    if (normalizedIntensity < 0.5) {
      // Blue to yellow
      const g = Math.floor(255 * (normalizedIntensity * 2));
      gradient.addColorStop(0, `rgba(0, ${g}, 255, 0.8)`);
      gradient.addColorStop(0.5, `rgba(0, ${g}, 255, 0.4)`);
    } else {
      // Yellow to red
      const b = Math.floor(255 * (1 - (normalizedIntensity - 0.5) * 2));
      gradient.addColorStop(0, `rgba(255, ${b}, 0, 0.8)`);
      gradient.addColorStop(0.5, `rgba(255, ${b}, 0, 0.4)`);
    }
    
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  });
};

/**
 * Render canvas to a destination
 * @param {HTMLCanvasElement} canvas - Canvas to render
 * @param {string|HTMLElement} dest - Destination element or query string
 */
const renderCanvas = (canvas, dest) => {
  let target;
  
  if (typeof dest === 'string') {
    // If dest is a string, treat as query selector
    if (dest.startsWith('#') || dest.startsWith('.')) {
      target = document.querySelector(dest);
    } else {
      // If not a selector, assume it's an element ID
      target = document.getElementById(dest);
    }
  } else if (dest instanceof HTMLElement) {
    // If dest is already an element
    target = dest;
  }
  
  if (target) {
    // Clear previous content
    target.innerHTML = '';
    // Append the canvas
    target.appendChild(canvas);
  }
};

/**
 * Get the current screen size
 * @returns {string} Screen dimensions in format "widthxheight"
 */
export const getScreenSize = () => {
  return `${window.innerWidth}x${window.innerHeight}`;
};

/**
 * Convert coordinate map to JSON
 * @param {string} mapId - ID of the map to convert
 * @returns {string} JSON string of the coordinate data
 */
export const coordMapToJson = (mapId = 'default') => {
  return JSON.stringify(coordMaps[mapId] || []);
};

/**
 * Load coordinate map from array of data
 * @param {Array} coords - Coordinate data
 * @param {string} mapId - ID to assign to the map
 * @param {boolean} append - Whether to append to existing map
 */
export const loadCoordMap = (coords, mapId = 'default', append = false) => {
  if (!append || !coordMaps[mapId]) {
    coordMaps[mapId] = [];
  }
  
  if (Array.isArray(coords)) {
    coordMaps[mapId] = coordMaps[mapId].concat(coords);
  }
};

/**
 * Get a coordinate map by ID
 * @param {string} mapId - ID of the map to retrieve
 * @returns {Array} The coordinate map data
 */
export const getCoordMap = (mapId = 'default') => {
  return coordMaps[mapId] || [];
};

/**
 * Clear a coordinate map
 * @param {string} mapId - ID of the map to clear
 */
export const clearCoordMap = (mapId = 'default') => {
  coordMaps[mapId] = [];
};

/**
 * Save the heatmap as an image
 * @param {string} mapId - ID of the map to save
 * @param {string} filename - Name of the file to save
 */
export const saveHeatmapAsImage = (mapId = 'default', filename = 'heatmap.png') => {
  const canvas = generateHeatMap(null, {}, [mapId]);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}; 