from fastapi import Depends
from .database import SessionLocal
import base64

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
def calculate_heatmap_stats(heatmap):
    """
    Calculate statistics from a heatmap image
    """
    # This would normally calculate real statistics
    # For now, return dummy values
    return {
        "mean_intensity": 0.5,
        "max_intensity": 0.95,
        "variance": 0.1,
        "focus_regions": 3
    } 