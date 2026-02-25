import sys
import os

# Try to extract PDF text
try:
    import PyPDF2
    
    pdf_path = r"C:\Users\user\ai-mcq-exam-system\docx\IdeaSpark.pdf"
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        print(f"=== IdeaSpark.pdf ({len(pdf_reader.pages)} pages) ===\n")
        for page_num, page in enumerate(pdf_reader.pages, 1):
            print(f"--- Page {page_num} ---")
            print(page.extract_text())
            print()
except ImportError:
    print("PyPDF2 not installed. Installing...")
    os.system("pip install PyPDF2")
except Exception as e:
    print(f"Error reading PDF: {e}")

# Try to extract Word document text
try:
    from docx import Document
    
    docx_path = r"C:\Users\user\ai-mcq-exam-system\docx\PBL sem 6 (revised problem statement).docx"
    doc = Document(docx_path)
    print(f"\n\n=== PBL Problem Statement ===\n")
    for para in doc.paragraphs:
        if para.text.strip():
            print(para.text)
except ImportError:
    print("python-docx not installed. Installing...")
    os.system("pip install python-docx")
except Exception as e:
    print(f"Error reading Word document: {e}")

# Try to extract SRS PDF
try:
    import PyPDF2
    
    pdf_path = r"C:\Users\user\ai-mcq-exam-system\docx\SRS.pdf"
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        print(f"\n\n=== SRS.pdf ({len(pdf_reader.pages)} pages) ===\n")
        for page_num, page in enumerate(pdf_reader.pages, 1):
            print(f"--- Page {page_num} ---")
            print(page.extract_text())
            print()
except Exception as e:
    print(f"Error reading SRS PDF: {e}")
