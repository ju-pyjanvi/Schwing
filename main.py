from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from dotenv import load_dotenv
from routers import ocr, analyze, export

load_dotenv()

app = FastAPI(title="Schwing")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(ocr.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(export.router, prefix="/api")

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@app.get("/app")
async def app_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/about")
async def about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})

@app.get("/results")
async def results_page(request: Request):
    return templates.TemplateResponse("results.html", {"request": request})

@app.get("/map")
async def map_page(request: Request):
    return templates.TemplateResponse("map.html", {"request": request})