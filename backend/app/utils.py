from fastapi import Depends
from .database import SessionLocal
import base64
from sqlalchemy.orm import Session
import numpy as np
import cv2

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Function to generate a simple heatmap
def generate_heatmap(gaze_data, width, height):
    """
    Generate a heatmap from gaze data
    Returns colored heatmap and raw heatmap
    """
    # Dummy implementation that doesn't require numpy/PIL
    # In a real implementation, this would create a heatmap image
    heatmap_colored = "dummy_heatmap"
    heatmap = "dummy_raw_heatmap"
    
    return heatmap_colored, heatmap

# Function to convert an image to base64
def img_to_base64(img):
    """Convert an image to base64 string"""
    # Dummy implementation that doesn't require PIL
    # In a real implementation, this would convert an image to base64
    return "base64_encoded_image_data"

# Function to calculate heatmap statistics
def calculate_heatmap_stats(image):
    """Calculate basic statistics for an image to be used with heatmaps"""
    try:
        # Convert to grayscale if it's a color image
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        # Calculate basic statistics
        stats = {
            'mean': float(np.mean(gray)),
            'median': float(np.median(gray)),
            'std_dev': float(np.std(gray)),
            'variance': float(np.var(gray)),
            'max': float(np.max(gray)),
            'min': float(np.min(gray)),
            'high_intensity_ratio': float(np.sum(gray > 200) / gray.size)
        }
        
        return stats
    except Exception as e:
        print(f"Error calculating heatmap stats: {str(e)}")
        return {} 