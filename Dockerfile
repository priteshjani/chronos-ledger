# Single-stage container packaging for Cloud Run
FROM python:3.9-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend
COPY frontend/dist/ ./frontend/dist
COPY config.json ./

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080
ENV PORT 8080

# Run uvicorn server pointing to main FastAPI app
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
