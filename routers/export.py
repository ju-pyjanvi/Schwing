from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
import io

router = APIRouter()

class ExportRequest(BaseModel):
    take_home: float
    debts: List[Any]
    analysis: Any

@router.post("/export")
async def export_pdf(req: ExportRequest):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    BLUE = colors.HexColor("#12AAED")
    DARK = colors.HexColor("#2D5F6E")

    title_style = ParagraphStyle("title", fontSize=24, textColor=BLUE, spaceAfter=6, fontName="Helvetica-Bold")
    heading_style = ParagraphStyle("heading", fontSize=14, textColor=DARK, spaceAfter=4, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("body", fontSize=11, spaceAfter=4)

    story = []

    story.append(Paragraph("Schwing", title_style))
    story.append(Paragraph("Your Personal Debt Payoff Plan", body_style))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Your Situation", heading_style))
    story.append(Paragraph(req.analysis.get("summary", ""), body_style))
    story.append(Paragraph(f"Monthly Take-Home: ₹{req.take_home:,.0f}", body_style))
    story.append(Paragraph(f"Monthly Surplus: ₹{req.analysis.get('monthly_surplus', 0):,.0f}", body_style))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Your Debts", heading_style))
    debt_data = [["Debt", "Total Amount", "Interest Rate", "Monthly EMI"]]
    for d in req.debts:
        debt_data.append([d["name"], f"₹{d['total_amount']:,.0f}", f"{d['interest_rate']}%", f"₹{d['monthly_emi']:,.0f}"])
    
    table = Table(debt_data, colWidths=[5*cm, 4*cm, 3*cm, 4*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BLUE),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#EEF9FE")]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.5*cm))

    rec = req.analysis.get("recommendation", "avalanche")
    story.append(Paragraph(f"Recommended Strategy: {rec.title()}", heading_style))
    story.append(Paragraph(req.analysis.get("recommendation_reason", ""), body_style))
    story.append(Spacer(1, 0.3*cm))

    for strategy in ["avalanche", "snowball"]:
        s = req.analysis.get(strategy, {})
        story.append(Paragraph(f"{strategy.title()} Method", heading_style))
        story.append(Paragraph(f"Payoff order: {' → '.join(s.get('order', []))}", body_style))
        story.append(Paragraph(f"Total interest paid: ₹{s.get('total_interest_paid', 0):,.0f}", body_style))
        story.append(Paragraph(f"Debt-free in: {s.get('months_to_debt_free', 0)} months", body_style))
        story.append(Spacer(1, 0.3*cm))

        plan = s.get("monthly_plan", [])
        if plan:
            plan_data = [["Month", "Actions", "Remaining Debt"]]
            for m in plan:
                plan_data.append([f"Month {m['month']}", m["actions"], f"₹{m['remaining_debt']:,.0f}"])
            plan_table = Table(plan_data, colWidths=[3*cm, 10*cm, 4*cm])
            plan_table.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), DARK),
                ("TEXTCOLOR", (0,0), (-1,0), colors.white),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#EEF9FE")]),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("PADDING", (0,0), (-1,-1), 5),
            ]))
            story.append(plan_table)
            story.append(Spacer(1, 0.5*cm))

    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=schwing_debt_plan.pdf"}
    )