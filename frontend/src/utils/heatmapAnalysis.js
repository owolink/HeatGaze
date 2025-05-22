/**
 * Heatmap analysis utilities for detecting and analyzing patterns in heatmaps
 * 
 * This module focuses on calculating metrics about heatmaps, particularly
 * for detecting "hotspots" - areas of high intensity in gaze and cursor heatmaps.
 * The results are meant to be used for statistical analysis, not directly for visualization.
 */

/**
 * Downsamples a heatmap to reduce processing load
 * 
 * @param {Array} heatmapData - 2D array of intensity values
 * @param {number} factor - Downsampling factor (higher = more aggressive downsampling)
 * @returns {Array} Downsampled 2D array
 */
const downsampleHeatmap = (heatmapData, factor = 2) => {
  if (!heatmapData || !heatmapData.length || !heatmapData[0].length) {
    return [];
  }
  
  const originalHeight = heatmapData.length;
  const originalWidth = heatmapData[0].length;
  
  const newHeight = Math.ceil(originalHeight / factor);
  const newWidth = Math.ceil(originalWidth / factor);
  
  const downsampled = Array(newHeight).fill().map(() => Array(newWidth).fill(0));
  
  // For each cell in the downsampled map, take the maximum value from the original region
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < originalWidth; x++) {
      const newY = Math.floor(y / factor);
      const newX = Math.floor(x / factor);
      
      // Use max pooling to preserve important features
      downsampled[newY][newX] = Math.max(
        downsampled[newY][newX],
        heatmapData[y][x]
      );
    }
  }
  
  console.log(`Downsampled heatmap from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}`);
  return downsampled;
};

/**
 * Calculate a percentile-based threshold for finding hotspots
 * More robust than mean+stddev for skewed distributions
 * 
 * @param {Array} heatmapData - 2D array of intensity values
 * @param {number} percentile - Percentile to use as threshold (0-100)
 * @returns {number} Threshold value
 */
const calculatePercentileThreshold = (heatmapData, percentile = 90) => {
  if (!heatmapData || !heatmapData.length) return 0.5;
  
  // Collect all non-zero values
  const values = [];
  for (let y = 0; y < heatmapData.length; y++) {
    for (let x = 0; x < heatmapData[0].length; x++) {
      const value = heatmapData[y][x];
      if (value > 0) {
        values.push(value);
      }
    }
  }
  
  if (values.length === 0) return 0.5;
  
  // Sort values and find the requested percentile
  values.sort((a, b) => a - b);
  const index = Math.floor(values.length * (percentile / 100));
  const threshold = values[Math.min(index, values.length - 1)];
  
  console.log(`Percentile threshold (${percentile}th): ${threshold.toFixed(3)} from ${values.length} values`);
  return threshold;
};

/**
 * Iterative (non-recursive) flood fill algorithm to find connected components
 * Avoids call stack limitations with large maps
 * 
 * @param {Array} heatmapData - 2D array of intensity values
 * @param {number} threshold - Intensity threshold
 * @param {number} minClusterSize - Minimum cluster size to consider
 * @returns {Array} Array of clusters
 */
const iterativeFloodFill = (heatmapData, threshold, minClusterSize = 20) => {
  if (!heatmapData || !heatmapData.length) return [];
  
  const height = heatmapData.length;
  const width = heatmapData[0].length;
  const visited = Array(height).fill().map(() => Array(width).fill(false));
  const clusters = [];
  
  // 8-way connectivity neighbors
  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Skip if already visited or below threshold
      if (visited[y][x] || heatmapData[y][x] < threshold) continue;
      
      // Start a new cluster with this seed point
      const cluster = [];
      const queue = [{x, y}];
      visited[y][x] = true;
      
      // Process queue iteratively (instead of recursively)
      while (queue.length > 0) {
        const current = queue.shift();
        cluster.push(current);
        
        // Check all neighbors
        for (const [dx, dy] of neighbors) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          
          // Skip out-of-bounds or already visited neighbors
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited[ny][nx]) continue;
          
          // Add to queue if above threshold
          if (heatmapData[ny][nx] >= threshold) {
            visited[ny][nx] = true;
            queue.push({x: nx, y: ny});
          }
        }
      }
      
      // Only keep clusters above minimum size
      if (cluster.length >= minClusterSize) {
        // Calculate cluster properties
        let maxIntensity = 0;
        let totalIntensity = 0;
        let centerX = 0;
        let centerY = 0;
        
        for (const point of cluster) {
          const intensity = heatmapData[point.y][point.x];
          totalIntensity += intensity;
          centerX += point.x * intensity; // Weighted by intensity
          centerY += point.y * intensity;
          maxIntensity = Math.max(maxIntensity, intensity);
        }
        
        // Weighted center
        centerX = totalIntensity > 0 ? centerX / totalIntensity : 0;
        centerY = totalIntensity > 0 ? centerY / totalIntensity : 0;
        
        clusters.push({
          center: { x: centerX, y: centerY },
          size: cluster.length,
          maxIntensity,
          avgIntensity: totalIntensity / cluster.length
        });
      }
    }
  }
  
  return clusters;
};

/**
 * Merges nearby clusters that are likely part of the same logical hotspot
 * 
 * @param {Array} clusters - Array of cluster objects
 * @param {number} distanceThreshold - Maximum distance to consider merging
 * @returns {Array} Merged clusters
 */
const mergeClusters = (clusters, distanceThreshold = 20) => {
  if (!clusters || clusters.length <= 1) return clusters;
  
  // Track which clusters should be merged
  const mergeGroups = [];
  const clusterCount = clusters.length;
  
  // Find clusters to merge using a simple distance check
  for (let i = 0; i < clusterCount; i++) {
    for (let j = i + 1; j < clusterCount; j++) {
      const dx = clusters[i].center.x - clusters[j].center.x;
      const dy = clusters[i].center.y - clusters[j].center.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance <= distanceThreshold) {
        // Find or create merge groups
        let foundGroup = false;
        
        for (const group of mergeGroups) {
          if (group.includes(i) || group.includes(j)) {
            if (!group.includes(i)) group.push(i);
            if (!group.includes(j)) group.push(j);
            foundGroup = true;
            break;
          }
        }
        
        if (!foundGroup) {
          mergeGroups.push([i, j]);
        }
      }
    }
  }
  
  // No clusters to merge
  if (mergeGroups.length === 0) return clusters;
  
  // Resolve transitive merges (if A merges with B and B with C, then A should merge with C)
  let changed = true;
  while (changed) {
    changed = false;
    
    for (let i = 0; i < mergeGroups.length; i++) {
      for (let j = i + 1; j < mergeGroups.length; j++) {
        const group1 = mergeGroups[i];
        const group2 = mergeGroups[j];
        
        // Check if groups have common elements
        const hasCommon = group1.some(idx => group2.includes(idx));
        
        if (hasCommon) {
          // Merge the groups
          const combined = [...new Set([...group1, ...group2])];
          mergeGroups[i] = combined;
          mergeGroups.splice(j, 1); // Remove the second group
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  
  // Create a map of which original cluster goes to which merged result
  const clusterMap = new Array(clusterCount).fill(-1);
  let nextId = 0;
  
  // Assign cluster IDs for merge groups
  for (const group of mergeGroups) {
    for (const idx of group) {
      clusterMap[idx] = nextId;
    }
    nextId++;
  }
  
  // Assign IDs for remaining clusters
  for (let i = 0; i < clusterCount; i++) {
    if (clusterMap[i] === -1) {
      clusterMap[i] = nextId++;
    }
  }
  
  // Create merged clusters
  const mergedCount = nextId;
  const mergedClusters = new Array(mergedCount).fill(null).map(() => ({
    center: { x: 0, y: 0 },
    size: 0,
    maxIntensity: 0,
    totalIntensity: 0,
    mergedCount: 0
  }));
  
  // Accumulate properties for merged clusters
  for (let i = 0; i < clusterCount; i++) {
    const targetIdx = clusterMap[i];
    const cluster = clusters[i];
    const target = mergedClusters[targetIdx];
    
    target.totalIntensity = (target.totalIntensity || 0) + (cluster.avgIntensity * cluster.size);
    target.size += cluster.size;
    target.maxIntensity = Math.max(target.maxIntensity, cluster.maxIntensity);
    target.mergedCount++;
    
    // Weighted position update
    const weight = cluster.avgIntensity * cluster.size;
    target.center.x += cluster.center.x * weight;
    target.center.y += cluster.center.y * weight;
  }
  
  // Finalize merged clusters
  for (const cluster of mergedClusters) {
    if (cluster.totalIntensity > 0) {
      cluster.center.x /= cluster.totalIntensity;
      cluster.center.y /= cluster.totalIntensity;
    }
    cluster.avgIntensity = cluster.totalIntensity / cluster.size;
  }
  
  console.log(`Merged ${clusterCount} clusters into ${mergedClusters.length} (${clusterCount - mergedClusters.length} merges)`);
  return mergedClusters;
};

/**
 * Detects hotspots in a heatmap using downsampling, thresholding, and connected component analysis
 * Optimized version for handling large heatmaps (30,000-50,000+ points)
 * 
 * @param {Array} heatmapData - 2D array of heatmap intensity values (0-1)
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Fixed threshold value (default: 0.6)
 * @param {number} options.percentile - Percentile for adaptive thresholding (default: 90)
 * @param {boolean} options.usePercentileThreshold - Whether to use percentile thresholding (default: true)
 * @param {number} options.downsamplingFactor - Downsampling factor to reduce computation (default: 2)
 * @param {number} options.minClusterSize - Minimum size for a region to be considered a hotspot (default: 20)
 * @param {number} options.mergeDistance - Distance threshold for merging nearby clusters (default: 20)
 * @returns {Object} Analysis results including hotspot count and locations
 */
export const detectHotspots = (heatmapData, options = {}) => {
  // Default options for large datasets
  const {
    threshold = 0.6,
    percentile = 90,
    usePercentileThreshold = true,
    downsamplingFactor = 2,
    minClusterSize = 20,
    mergeDistance = 20
  } = options;
  
  if (!heatmapData || !heatmapData.length || !heatmapData[0].length) {
    console.warn('Invalid heatmap data provided to hotspot detection');
    return { hotspotCount: 0, hotspots: [] };
  }
  
  console.log(`Processing heatmap of size ${heatmapData[0].length}x${heatmapData.length}`);
  
  // Step 1: Downsample to reduce computation
  const downsampledMap = downsampleHeatmap(heatmapData, downsamplingFactor);
  
  // Step 2: Calculate threshold
  const actualThreshold = usePercentileThreshold
    ? calculatePercentileThreshold(downsampledMap, percentile)
    : threshold;
    
  console.log(`Using threshold: ${actualThreshold.toFixed(3)}`);
  
  // Step 3: Find connected components (clusters)
  const initialClusters = iterativeFloodFill(downsampledMap, actualThreshold, minClusterSize);
  console.log(`Found ${initialClusters.length} initial clusters`);
  
  // Step 4: Merge nearby clusters
  const mergedClusters = mergeClusters(initialClusters, mergeDistance);
  console.log(`Final hotspot count: ${mergedClusters.length}`);
  
  // Adjust coordinates back to original scale if downsampled
  if (downsamplingFactor > 1) {
    for (const cluster of mergedClusters) {
      cluster.center.x *= downsamplingFactor;
      cluster.center.y *= downsamplingFactor;
      // Adjust size approximation
      cluster.originalSize = cluster.size;
      cluster.size *= (downsamplingFactor * downsamplingFactor);
    }
  }
  
  return {
    hotspotCount: mergedClusters.length,
    hotspots: mergedClusters,
    threshold: actualThreshold
  };
};

/**
 * Compare two sets of hotspots to find common regions
 * This provides the "common_hotspots" metric used in correlation analysis
 * 
 * @param {Array} hotspots1 - First array of hotspot objects
 * @param {Array} hotspots2 - Second array of hotspot objects
 * @param {Object} options - Comparison options
 * @param {number} options.maxDistance - Maximum distance to consider hotspots as matching
 * @returns {Object} Analysis of common hotspots
 */
export const findCommonHotspots = (hotspots1, hotspots2, options = {}) => {
  const { maxDistance = 50 } = options;
  
  if (!hotspots1 || !hotspots2 || !hotspots1.length || !hotspots2.length) {
    return { commonCount: 0, matches: [] };
  }
  
  const matches = [];
  
  // For each hotspot in the first set, find closest match in second set
  for (const spot1 of hotspots1) {
    let bestMatch = null;
    let minDistance = Infinity;
    
    for (const spot2 of hotspots2) {
      const dx = spot1.center.x - spot2.center.x;
      const dy = spot1.center.y - spot2.center.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = spot2;
      }
    }
    
    if (bestMatch && minDistance <= maxDistance) {
      matches.push({
        spot1,
        spot2: bestMatch,
        distance: minDistance
      });
    }
  }
  
  console.log(`Found ${matches.length} matching hotspots between two sets`);
  
  return {
    commonCount: matches.length,
    matches
  };
};

/**
 * Utility to convert a base64 image to a 2D intensity array
 * Used as a pre-processing step before hotspot detection
 * 
 * @param {string} base64Image - Base64 encoded image data
 * @returns {Promise<Array>} 2D array of intensity values
 */
export const convertImageToIntensityMap = (base64Image) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      
      // Extract intensity from RGBA data (use alpha as intensity weight)
      const intensityMap = Array(height).fill().map(() => Array(width).fill(0));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          // Calculate intensity as average of RGB weighted by alpha
          const alpha = data[idx + 3] / 255;
          intensityMap[y][x] = alpha * (data[idx] + data[idx + 1] + data[idx + 2]) / (3 * 255);
        }
      }
      
      resolve(intensityMap);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image data'));
    };
    
    img.src = `data:image/png;base64,${base64Image}`;
  });
};

export default {
  detectHotspots,
  findCommonHotspots,
  convertImageToIntensityMap
};