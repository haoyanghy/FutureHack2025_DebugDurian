from PIL import Image
from pytesseract import pytesseract

def load_model():
    path_to_tesseract = r"/usr/bin/tesseract"
    return path_to_tesseract

def extract_word(image_path):
    path_to_tesseract = load_model()
    img = Image.open(image_path)
    pytesseract.tesseract_cmd = path_to_tesseract
    text = pytesseract.image_to_string(img)
    return text[:1]