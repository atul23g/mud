.PHONY: install train api ui test clean help prisma-generate prisma-migrate prisma-push setup test-db

# Install dependencies
install:
	pip install -r requirements.txt

# Setup everything
setup:
	./setup_complete.sh

# Prisma commands
prisma-generate:
	python -m prisma generate

prisma-migrate:
	python -m prisma migrate dev --name init

prisma-push:
	python -m prisma db push

# Test database connection
test-db:
	python test_db_connection.py

# Train all models
train:
	python -m src.models.train_heart
	python -m src.models.train_diabetes
	python -m src.models.train_anemia_tab
	python -m src.models.train_anemia_img

# Run API server
api:
	uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Run Streamlit UI
ui:
	streamlit run src/ui/streamlit_app.py

# Run tests
test:
	pytest tests/ -v --cov=src --cov-report=html

# Clean generated files
clean:
	find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -r {} + 2>/dev/null || true
	rm -rf outputs/mlruns/
	rm -rf .pytest_cache/
	rm -rf htmlcov/

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up

docker-down:
	docker-compose down

# Help
help:
	@echo "Available commands:"
	@echo "  make install          - Install dependencies"
	@echo "  make setup            - Complete setup (install + prisma + test)"
	@echo "  make prisma-generate  - Generate Prisma client"
	@echo "  make prisma-push      - Push schema to database"
	@echo "  make test-db          - Test database connection"
	@echo "  make train            - Train all models"
	@echo "  make api              - Run FastAPI server"
	@echo "  make ui               - Run Streamlit UI"
	@echo "  make test             - Run tests"
	@echo "  make clean            - Clean generated files"
