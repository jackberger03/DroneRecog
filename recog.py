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
import threading
from concurrent.futures import ThreadPoolExecutor
from queue import Queue, Empty  # Add Empty to the import

class Item(typing.TypedDict):
    name: str
    brand: str
    model: str
    location: str
    price: float

class USBImageScanner:
    def __init__(self, api_key, output_dir="processed_images", num_threads=4):
        self.api_key = api_key
        self.output_dir = output_dir
        self.processed_files = set()
        self.num_threads = num_threads
        self.image_queue = Queue()
        self.stop_event = threading.Event()
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name="gemini-1.5-pro-exp-0827",
            generation_config=genai.GenerationConfig(
                temperature=1,
                top_p=0.95,
                top_k=40,
                max_output_tokens=32192,
                response_mime_type="application/json",
                response_schema=list[Item]
            )
        )

    def get_usb_drives(self):
        """Detect all USB drives connected to the system."""
        usb_drives = []
        
        # Get all disk partitions
        for partition in psutil.disk_partitions():
            # Check if it's a removable drive (likely USB)
            try:
                if 'removable' in partition.opts or 'usb' in partition.opts.lower():
                    usb_drives.append(partition.mountpoint)
            except:
                continue
                
        return usb_drives

    def scan_for_images(self, drive_path):
        """Scan for JPEG images in the given drive path."""
        image_files = []
        # Look for both .jpg and .jpeg files
        for ext in ('*.jpg', '*.jpeg'):
            image_files.extend(glob.glob(os.path.join(drive_path, '**', ext), recursive=True))
        return image_files

    def process_image(self, image_path):
        """Process a single image through the Gemini model."""
        try:
            # Load and process the image
            image = PIL.Image.open(image_path)
            
            # Prepare the prompt
            prompt = "List everything in this image - be specific on name, brand and model - also specify where each item is in the image - use estimated pixels location - include estimated price"
            
            # Generate content
            response = self.model.generate_content([prompt, image])
            
            # Parse the JSON content
            items = json.loads(response.text)
            
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
            
            print(f"Successfully processed: {base_name}")
            
        except Exception as e:
            print(f"Error processing {image_path}: {str(e)}")

    def process_queue(self):
        """Worker function to process images from the queue."""
        while not self.stop_event.is_set():
            try:
                image_path = self.image_queue.get(timeout=1)
                self.process_image(image_path)
                self.image_queue.task_done()
            except Empty:  # Changed from Queue.Empty to Empty
                continue
            except Exception as e:
                print(f"Worker error: {str(e)}")

    def run(self, interval=30):
        """Main loop with multi-threading support."""
        print("Starting USB image scanner with", self.num_threads, "threads...")
        print(f"Processed images and analysis will be saved to: {self.output_dir}")
        
        # Create thread pool
        workers = []
        for _ in range(self.num_threads):
            thread = threading.Thread(target=self.process_queue)
            thread.daemon = True
            thread.start()
            workers.append(thread)
        
        try:
            while not self.stop_event.is_set():
                usb_drives = self.get_usb_drives()
                
                for drive in usb_drives:
                    print(f"Scanning drive: {drive}")
                    images = self.scan_for_images(drive)
                    
                    # Add new images to queue
                    for image_path in images:
                        if image_path not in self.processed_files:
                            self.image_queue.put(image_path)
                
                print(f"Scan complete. Waiting {interval} seconds before next scan...")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\nStopping scanner...")
            self.stop_event.set()
            
            # Wait for all threads to complete
            for thread in workers:
                thread.join()
        except Exception as e:
            print(f"Error during scan: {str(e)}")
            time.sleep(interval)

def main():
    # Replace with your actual API key
    API_KEY = ""
    
    # Create and run the scanner
    scanner = USBImageScanner(api_key=API_KEY)
    scanner.run()

if __name__ == "__main__":
    main()
