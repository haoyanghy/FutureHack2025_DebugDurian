from PIL import Image
from pytesseract import pytesseract
import platform

def load_model():
    if platform.system() == "Windows":
        return r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    else:
        return "/usr/bin/tesseract"

def extract_word(image_path):
    path_to_tesseract = load_model()
    img = Image.open(image_path)
    pytesseract.tesseract_cmd = path_to_tesseract
    text = pytesseract.image_to_string(img)
    return text  # Return the full text