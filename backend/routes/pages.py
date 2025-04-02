from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from app.utils import get_db
from sqlalchemy.orm import Session
from app.models import User
from routes.auth import get_current_user
from datetime import datetime
import random

# Router
router = APIRouter()

# Templates
templates = Jinja2Templates(directory="templates")

# Demo data for news
news_data = [
    {
        "id": 1,
        "title": "Новый метод анализа взгляда позволяет улучшить пользовательский опыт",
        "content": """Исследователи разработали новый метод анализа данных о движении глаз, который позволяет значительно улучшить пользовательский опыт на сайтах и в приложениях. Метод основан на применении алгоритмов машинного обучения для выявления паттернов в движениях глаз пользователей.

"Наше исследование показывает, что анализ тепловых карт на основе взгляда может выявить проблемы в интерфейсе, которые невозможно обнаружить другими методами", — говорит руководитель исследования. Технология уже применяется на нескольких крупных сайтах и показывает значительное улучшение показателей конверсии.""",
        "date": "2025-03-30",
        "author": "Иван Петров",
        "category": "Технологии"
    },
    {
        "id": 2,
        "title": "Разработчики представили новый формат отображения данных для тепловых карт",
        "content": """Команда разработчиков из компании "ТехноВижн" представила новый формат визуализации данных для тепловых карт, который позволяет более точно отображать области внимания пользователей. Формат получил название "HeatViz" и уже доступен для тестирования.

Основное преимущество нового формата заключается в возможности отображения временной динамики внимания пользователя, что позволяет оценить не только где, но и когда пользователь обращает внимание на определенные элементы интерфейса. 

"Мы разработали этот формат, чтобы помочь дизайнерам и маркетологам лучше понимать поведение пользователей", — сообщил главный разработчик проекта.""",
        "date": "2025-03-29",
        "author": "Мария Сидорова",
        "category": "Разработка"
    },
    {
        "id": 3,
        "title": "Как тепловые карты помогают оптимизировать конверсию на сайтах",
        "content": """Исследование, проведенное аналитической компанией "WebAnalyst", показало, что использование тепловых карт для анализа поведения пользователей может увеличить конверсию сайта на 15-25%. В исследовании приняли участие более 100 сайтов из различных отраслей.

Основные выводы исследования: 

1. Тепловые карты позволяют выявить неэффективные элементы интерфейса, которые не привлекают внимание пользователей.
2. Анализ движения взгляда помогает оптимизировать расположение ключевых элементов на странице.
3. Компании, регулярно использующие тепловые карты для анализа, демонстрируют более высокие показатели удержания пользователей.

"Самое удивительное открытие заключается в том, что многие элементы, которые дизайнеры считают важными, часто остаются незамеченными пользователями", — отметил руководитель исследования.""",
        "date": "2025-03-28",
        "author": "Алексей Кузнецов",
        "category": "Маркетинг"
    },
    {
        "id": 4,
        "title": "Нейросети научились предсказывать движение взгляда пользователя",
        "content": """Исследователи из Института искусственного интеллекта разработали нейросеть, способную предсказывать маршрут взгляда пользователя на веб-странице с точностью до 85%. Это открытие может революционизировать подход к проектированию веб-интерфейсов.

"Нейросеть анализирует структуру страницы и предсказывает, как пользователь будет взаимодействовать с ней визуально", — поясняет ведущий исследователь проекта. "Это позволяет дизайнерам оптимизировать расположение элементов еще до проведения тестирования с реальными пользователями".

Технология уже интегрирована в несколько популярных инструментов веб-дизайна и показывает обнадеживающие результаты.""",
        "date": "2025-03-27",
        "author": "Елена Смирнова",
        "category": "Искусственный интеллект"
    },
    {
        "id": 5,
        "title": "Новое исследование: 70% пользователей не замечают баннеры на сайтах",
        "content": """Согласно новому исследованию, проведенному компанией "UserEye", около 70% пользователей практически не обращают внимания на рекламные баннеры на веб-сайтах. Исследование основано на анализе данных о движении глаз более 10,000 пользователей при посещении различных типов сайтов.

"Мы наблюдаем явление, которое называется 'баннерная слепота'", — комментирует руководитель исследования. "Пользователи научились игнорировать области, которые выглядят как реклама, даже если там содержится полезная информация".

Исследование также выявило, что нестандартное размещение важной информации в "слепых зонах" может привести к потере до 50% конверсии.""",
        "date": "2025-03-26",
        "author": "Дмитрий Волков",
        "category": "UX Исследования"
    }
]

# Demo data for weather
weather_data = {
    "Москва": {
        "temp": 15,
        "condition": "Облачно с прояснениями",
        "humidity": 65,
        "wind": 5,
        "pressure": 750,
        "forecast": [
            {"date": "01.04.2025", "temp": 16, "condition": "Ясно"},
            {"date": "02.04.2025", "temp": 18, "condition": "Ясно"},
            {"date": "03.04.2025", "temp": 14, "condition": "Небольшой дождь"},
            {"date": "04.04.2025", "temp": 12, "condition": "Дождь"},
            {"date": "05.04.2025", "temp": 15, "condition": "Облачно"}
        ]
    },
    "Санкт-Петербург": {
        "temp": 12,
        "condition": "Дождь",
        "humidity": 80,
        "wind": 7,
        "pressure": 748,
        "forecast": [
            {"date": "01.04.2025", "temp": 13, "condition": "Облачно"},
            {"date": "02.04.2025", "temp": 14, "condition": "Небольшой дождь"},
            {"date": "03.04.2025", "temp": 11, "condition": "Дождь"},
            {"date": "04.04.2025", "temp": 10, "condition": "Дождь"},
            {"date": "05.04.2025", "temp": 12, "condition": "Облачно"}
        ]
    },
    "Екатеринбург": {
        "temp": 10,
        "condition": "Облачно",
        "humidity": 70,
        "wind": 6,
        "pressure": 745,
        "forecast": [
            {"date": "01.04.2025", "temp": 12, "condition": "Облачно"},
            {"date": "02.04.2025", "temp": 14, "condition": "Ясно"},
            {"date": "03.04.2025", "temp": 11, "condition": "Небольшой дождь"},
            {"date": "04.04.2025", "temp": 9, "condition": "Дождь"},
            {"date": "05.04.2025", "temp": 10, "condition": "Облачно"}
        ]
    },
    "Новосибирск": {
        "temp": 8,
        "condition": "Переменная облачность",
        "humidity": 65,
        "wind": 5,
        "pressure": 742,
        "forecast": [
            {"date": "01.04.2025", "temp": 10, "condition": "Ясно"},
            {"date": "02.04.2025", "temp": 12, "condition": "Ясно"},
            {"date": "03.04.2025", "temp": 9, "condition": "Облачно"},
            {"date": "04.04.2025", "temp": 7, "condition": "Небольшой дождь"},
            {"date": "05.04.2025", "temp": 8, "condition": "Облачно"}
        ]
    },
    "Казань": {
        "temp": 14,
        "condition": "Ясно",
        "humidity": 60,
        "wind": 4,
        "pressure": 749,
        "forecast": [
            {"date": "01.04.2025", "temp": 15, "condition": "Ясно"},
            {"date": "02.04.2025", "temp": 16, "condition": "Ясно"},
            {"date": "03.04.2025", "temp": 14, "condition": "Облачно"},
            {"date": "04.04.2025", "temp": 12, "condition": "Небольшой дождь"},
            {"date": "05.04.2025", "temp": 13, "condition": "Облачно"}
        ]
    }
}

# Routes
@router.get("/demo/news", response_model=list)
async def get_news():
    """Get all news articles for demo"""
    return news_data

@router.get("/demo/news/{news_id}", response_model=dict)
async def get_news_by_id(news_id: int):
    """Get a specific news article by ID"""
    for news in news_data:
        if news["id"] == news_id:
            return news
    raise HTTPException(status_code=404, detail="Новость не найдена")

@router.get("/demo/weather", response_model=dict)
async def get_weather():
    """Get weather data for all cities"""
    return weather_data

@router.get("/demo/weather/{city}", response_model=dict)
async def get_weather_by_city(city: str):
    """Get weather data for a specific city"""
    if city in weather_data:
        return weather_data[city]
    raise HTTPException(status_code=404, detail="Данные для указанного города не найдены")

@router.get("/demo/news-page", response_class=HTMLResponse)
async def get_news_page(request: Request):
    """Render news page template"""
    return templates.TemplateResponse(
        "news.html", 
        {
            "request": request,
            "news": news_data,
            "current_date": datetime.now().strftime("%d.%m.%Y")
        }
    )

@router.get("/demo/weather-page", response_class=HTMLResponse)
async def get_weather_page(request: Request):
    """Render weather page template"""
    return templates.TemplateResponse(
        "weather.html", 
        {
            "request": request,
            "weather": weather_data,
            "current_date": datetime.now().strftime("%d.%m.%Y")
        }
    )

@router.get("/demo/{page_name}", response_class=HTMLResponse)
async def get_demo_page(request: Request, page_name: str):
    """Serve demo pages"""
    try:
        return templates.TemplateResponse(f"{page_name}.html", {"request": request})
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Page {page_name} not found")

@router.get("/demo", response_class=HTMLResponse)
async def demo_page(request: Request):
    """Demo page for GazeCloudAPI integration"""
    return templates.TemplateResponse("demo.html", {"request": request}) 