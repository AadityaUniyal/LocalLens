import os
import sys
import requests
from pathlib import Path
import hashlib
def download_file(url: str, destination: str, expected_hash: str = None) -> bool:
    """
    Download file from URL with progress indication
    
    Args:
        url: URL to download from
        destination: Local file path to save to
        expected_hash: Optional SHA-256 hash to verify download
        
    Returns:
        True if download successful, False otherwise
    """
    try:
        print(f"Downloading {url}...")
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded_size = 0
        
        with open(destination, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    file.write(chunk)
                    downloaded_size += len(chunk)
                    
                    if total_size > 0:
                        progress = (downloaded_size / total_size) * 100
                        print(f"\rProgress: {progress:.1f}%", end='', flush=True)
        
        print(f"\nDownloaded to {destination}")
        
        # Verify hash if provided
        if expected_hash:
            if verify_file_hash(destination, expected_hash):
                print("✓ Hash verification passed")
            else:
                print("✗ Hash verification failed")
                return False
        
        return True
        
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def verify_file_hash(file_path: str, expected_hash: str) -> bool:
    """
    Verify file SHA-256 hash
    
    Args:
        file_path: Path to file
        expected_hash: Expected SHA-256 hash
        
    Returns:
        True if hash matches, False otherwise
    """
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as file:
            for chunk in iter(lambda: file.read(4096), b""):
                sha256_hash.update(chunk)
        
        actual_hash = sha256_hash.hexdigest()
        return actual_hash.lower() == expected_hash.lower()
        
    except Exception as e:
        print(f"Error verifying hash: {e}")
        return False

def main():
    """Main function to download YOLO models"""
    
    # Create models directory
    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)
    
    print("Traffic Management Platform - Model Downloader")
    print("=" * 50)
    
    # YOLO models to download
    models = [
        {
            "name": "YOLOv8 Nano",
            "url": "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt",
            "filename": "yolov8n.pt",
            "description": "Lightweight YOLO model for fast inference"
        },
        {
            "name": "YOLOv8 Small", 
            "url": "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8s.pt",
            "filename": "yolov8s.pt",
            "description": "Small YOLO model with better accuracy"
        },
        {
            "name": "YOLOv8 Medium",
            "url": "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8m.pt", 
            "filename": "yolov8m.pt",
            "description": "Medium YOLO model for balanced speed/accuracy"
        }
    ]
    
    # Download each model
    for i, model in enumerate(models, 1):
        print(f"\n[{i}/{len(models)}] {model['name']}")
        print(f"Description: {model['description']}")
        
        destination = models_dir / model['filename']
        
        # Skip if file already exists
        if destination.exists():
            print(f"✓ {model['filename']} already exists, skipping...")
            continue
        
        # Download the model
        success = download_file(model['url'], str(destination))
        
        if success:
            print(f"✓ Successfully downloaded {model['filename']}")
        else:
            print(f"✗ Failed to download {model['filename']}")
            sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✓ All models downloaded successfully!")
    print(f"Models saved to: {models_dir.absolute()}")
    
    # Create model info file
    info_file = models_dir / "model_info.txt"
    with open(info_file, 'w') as f:
        f.write("YOLO Models for Traffic Management Platform\n")
        f.write("=" * 45 + "\n\n")
        f.write("Downloaded models:\n")
        for model in models:
            f.write(f"- {model['filename']}: {model['description']}\n")
        f.write(f"\nDownloaded on: {__import__('datetime').datetime.now()}\n")
    
    print(f"Model information saved to: {info_file}")
    
    # Print usage instructions
    print("\nUsage Instructions:")
    print("1. Set MODEL_PATH environment variable to point to desired model:")
    print(f"   export MODEL_PATH={models_dir}/yolov8n.pt")
    print("2. Or update your .env file:")
    print(f"   MODEL_PATH={models_dir}/yolov8n.pt")
    print("\nModel recommendations:")
    print("- yolov8n.pt: Fastest, use for real-time applications")
    print("- yolov8s.pt: Good balance of speed and accuracy")
    print("- yolov8m.pt: Best accuracy, slower inference")

if __name__ == "__main__":
    main()
