import os
import glob
import shutil
import time
from pathlib import Path
import google.generativeai as genai
import PIL.Image
import json
import typing_extensions as typing
import psutil
from concurrent.futures import ThreadPoolExecutor
from queue import Queue, Empty
from google.ai.generativelanguage_v1beta.types import content

class Item(typing.TypedDict):
    name: str
    brand: str
    model: str
    location: str
    price: float

class USBImageScanner:
    def __init__(self, api_key, output_dir="/home/drone_processed"):
        self.api_key = api_key
        self.output_dir = output_dir
        self.processed_files = set()
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Configure Gemini with the new schema
        genai.configure(api_key=api_key)
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 32192,
            "response_schema": content.Schema(
                type=content.Type.ARRAY,
                items=content.Schema(
                    type=content.Type.OBJECT,
                    properties={
                        "name": content.Schema(type=content.Type.STRING),
                        "brand": content.Schema(type=content.Type.STRING),
                        "model": content.Schema(type=content.Type.STRING),
                        "location": content.Schema(type=content.Type.STRING),
                        "price": content.Schema(type=content.Type.NUMBER),
                    },
                    required=["name", "brand", "model", "location", "price"]
                )
            ),
            "response_mime_type": "application/json",
        }

        self.model = genai.GenerativeModel(
            model_name="gemini-1.5-pro-exp-0827",
            generation_config=generation_config
        )
        
        # Add logging to a file
        self.log_file = os.path.join(output_dir, "scanner.log")

    def get_usb_drives(self):
        """Detect all USB drives connected to the system."""
        usb_drives = []
        
        # Modified to specifically look for common DJI card mount points
        for partition in psutil.disk_partitions():
            try:
                if (partition.mountpoint.startswith('/media/pi') or  # Common Pi mount point
                    partition.mountpoint.startswith('/mnt')):        # Alternative mount point
                    # Verify it's a removable drive
                    if 'removable' in partition.opts or os.path.exists(os.path.join(partition.mountpoint, 'DCIM')):
                        usb_drives.append(partition.mountpoint)
            except:
                continue
                
        return usb_drives

    def scan_for_images(self, drive_path):
        """Scan for JPEG images in the given drive path."""
        image_files = []
        # Look specifically in DJI's directory structure
        dji_paths = ['DCIM/*/*.JPG', 'DCIM/*/*.jpg', 'DCIM/*/*.jpeg']
        for pattern in dji_paths:
            image_files.extend(glob.glob(os.path.join(drive_path, pattern), recursive=True))
        return image_files

    def log_message(self, message):
        """Add logging capability"""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] {message}\n"
        print(log_entry.strip())
        with open(self.log_file, 'a') as f:
            f.write(log_entry)

    def process_image(self, image_path):
        """Process a single image through the Gemini model."""
        try:
            # Add logging
            self.log_message(f"Processing: {image_path}")
            
            # Load and process the image
            image = PIL.Image.open(image_path)
            
            prompt = """Analyze this image and provide details about all items visible. For each item, include:
            - Specific product name
            - Manufacturer brand
            - Model number/name
            - Location in the image (as x,y coordinates)
            - Estimated market price in USD
            
            Return the data in a JSON array format."""
            
            # Generate content
            response = self.model.generate_content([prompt, image])
            
            # Parse and validate the JSON response
            try:
                items = json.loads(response.text)
                # Additional validation to ensure proper structure
                if not isinstance(items, list):
                    items = [items]  # Convert single item to list
                
                # Create output filename based on original filename
                base_name = os.path.basename(image_path)
                json_filename = f"{os.path.splitext(base_name)[0]}_analysis.json"
                json_path = os.path.join(self.output_dir, json_filename)
                
                # Save the analysis results
                with open(json_path, 'w') as f:
                    json.dump({"items": items}, f, indent=2)
                
                # Copy the original image to output directory
                shutil.copy2(image_path, self.output_dir)
                
                # Add to processed files
                self.processed_files.add(image_path)
                
                # Add success logging
                self.log_message(f"Successfully processed: {base_name}")
                
            except json.JSONDecodeError as je:
                self.log_message(f"JSON parsing error for {image_path}: {str(je)}")
                
        except Exception as e:
            self.log_message(f"Error processing {image_path}: {str(e)}")

    def run(self, interval=30):
        """Main loop without threading."""
        print("Starting USB image scanner...")
        print(f"Processed images and analysis will be saved to: {self.output_dir}")
        
        try:
            while True:
                usb_drives = self.get_usb_drives()
                
                for drive in usb_drives:
                    print(f"Scanning drive: {drive}")
                    images = self.scan_for_images(drive)
                    
                    # Process images directly
                    for image_path in images:
                        if image_path not in self.processed_files:
                            self.process_image(image_path)
                
                print(f"Scan complete. Waiting {interval} seconds before next scan...")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\nStopping scanner...")
        except Exception as e:
            print(f"Error during scan: {str(e)}")
            time.sleep(interval)

def main():
    # Load API key from environment variable or file
    api_key = os.getenv('GEMINI_API_KEY') or ""
    if not api_key:
        config_path = "/home/gemini_config.txt"
        try:
            with open(config_path) as f:
                api_key = f.read().strip()
        except:
            print("No API key found. Please set GEMINI_API_KEY environment variable or create /home/gemini_config.txt")
            return

    scanner = USBImageScanner(api_key=api_key)
    scanner.run()

if __name__ == "__main__":
    main()
