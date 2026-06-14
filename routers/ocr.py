from dotenv import load_dotenv
load_dotenv()

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
from pdf2image import convert_from_bytes
import pytesseract
from groq import Groq
import os, io, json, re

router = APIRouter()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@router.post("/ocr")
async def ocr_salary_slip(file: UploadFile = File(...)):
    content = await file.read()

    try:
        if file.content_type == "application/pdf":
            images = convert_from_bytes(content)
            raw_text = "".join(pytesseract.image_to_string(img) for img in images)
        else:
            image = Image.open(io.BytesIO(content))
            raw_text = pytesseract.image_to_string(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text found in file.")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user",
            "content": f"""Extract salary info from this text. Return ONLY valid JSON, no explanation, no markdown.

{{
  "employee_name": "string or null",
  "gross_salary": number or null,
  "take_home": number or null,
  "deductions": number or null,
  "company": "string or null"
}}

Text:
{raw_text}"""
        }]
    )

    clean = re.sub(r"```json|```", "", response.choices[0].message.content).strip()

    try:
        data = json.loads(clean)
    except:
        raise HTTPException(status_code=500, detail="Could not parse salary data.")

    return {"success": True, "data": data}