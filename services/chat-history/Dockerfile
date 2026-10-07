FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py offers.py catalog.json .
USER 65534:65534
CMD ["python", "app.py"]
