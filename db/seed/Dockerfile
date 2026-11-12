FROM python:3.12-slim
WORKDIR /app
COPY db/seed/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY db/seed/generate_seed_data.py ./generate_seed_data.py
CMD ["python", "generate_seed_data.py"]
