from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from groq import Groq
import os, json, re

load_dotenv()
router = APIRouter()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class Debt(BaseModel):
    name: str
    total_amount: float
    interest_rate: float
    monthly_emi: float

class AnalyzeRequest(BaseModel):
    take_home: float
    debts: List[Debt]

@router.post("/analyze")
async def analyze_debts(req: AnalyzeRequest):
    debts_text = "\n".join(
        f"- {d.name}: ₹{d.total_amount} total, {d.interest_rate}% interest, ₹{d.monthly_emi} EMI"
        for d in req.debts
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user",
            "content": f"""You are a personal finance advisor for Indians. Analyze these debts and return ONLY valid JSON, no explanation, no markdown.

Monthly take-home salary: ₹{req.take_home}
Debts:
{debts_text}

Return this exact structure:
{{
  "summary": "2-3 sentence plain English summary of their situation",
  "monthly_surplus": number,
  "avalanche": {{
    "order": ["debt name 1", "debt name 2"],
    "total_interest_paid": number,
    "months_to_debt_free": number,
    "monthly_plan": [
      {{"month": 1, "actions": "what to pay this month", "remaining_debt": number}}
    ]
  }},
  "snowball": {{
    "order": ["debt name 1", "debt name 2"],
    "total_interest_paid": number,
    "months_to_debt_free": number,
    "monthly_plan": [
      {{"month": 1, "actions": "what to pay this month", "remaining_debt": number}}
    ]
  }},
  "recommendation": "avalanche or snowball",
  "recommendation_reason": "one sentence why"
}}

Only include first 6 months in monthly_plan. Return pure JSON only."""
        }]
    )

    clean = re.sub(r"```json|```", "", response.choices[0].message.content).strip()

    try:
        data = json.loads(clean)
    except:
        raise HTTPException(status_code=500, detail="Could not parse analysis.")

    return {"success": True, "data": data}