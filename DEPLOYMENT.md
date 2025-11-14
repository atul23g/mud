# Production Deployment Guide

## Overview
This guide covers deploying MediSense AI to production environments with proper security, performance, and reliability configurations.

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Set up production database (Neon Postgres recommended)
- [ ] Configure JWT secret with strong random key
- [ ] Set up LLM API keys (Gemini/Groq) for AI functionality
- [ ] Configure CORS origins for your domain
- [ ] Set up SSL/TLS certificates

### 2. Security Configuration
- [ ] Update `.env.production` with production values
- [ ] Configure `ALLOWED_HOSTS` and `ALLOWED_ORIGINS`
- [ ] Enable `FORCE_HTTPS=true` for production
- [ ] Set up rate limiting and DDoS protection
- [ ] Configure firewall rules

### 3. Performance Optimization
- [ ] Enable database connection pooling
- [ ] Set up CDN for static assets
- [ ] Configure caching strategies
- [ ] Optimize database indexes
- [ ] Set up monitoring and logging

## Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Build and Run
```bash
# Build the Docker image
docker build -t medisense-ai:latest .

# Run with production environment
docker run -d \
  --name medisense-api \
  -p 8000:8000 \
  --env-file .env.production \
  --restart unless-stopped \
  medisense-ai:latest
```

#### Docker Compose (For full stack)
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file: .env.production
    restart: unless-stopped
    depends_on:
      - db
  
  frontend:
    build: ./web
    ports:
      - "5173:80"
    depends_on:
      - api
```

### Option 2: Cloud Platform Deployment

#### Vercel (Frontend)
```bash
cd web
vercel --prod
```

#### Railway/Render/Fly.io (Backend)
1. Connect GitHub repository
2. Set environment variables from `.env.production`
3. Deploy with auto-restart on failure

#### AWS Deployment
- **EC2**: Run Docker containers on EC2 instances
- **RDS**: Use managed PostgreSQL database
- **CloudFront**: CDN for global distribution
- **ALB**: Application Load Balancer for high availability

### Option 3: Traditional Server Deployment

#### System Requirements
- Ubuntu 20.04+ / CentOS 8+
- Python 3.11+
- Node.js 18+
- PostgreSQL 13+
- Nginx (reverse proxy)
- Supervisor (process management)

#### Setup Steps
```bash
# Install system dependencies
sudo apt update
sudo apt install python3.11 nodejs npm postgresql nginx supervisor tesseract-ocr

# Clone repository
git clone <your-repo-url> medisense-ai
cd medisense-ai

# Setup backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup frontend
cd web
npm install
npm run build
cd ..

# Configure Nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/medisense
sudo ln -s /etc/nginx/sites-available/medisense /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Setup Supervisor
sudo cp deployment/supervisor.conf /etc/supervisor/conf.d/medisense.conf
sudo supervisorctl reread && sudo supervisorctl update
```

## Environment Variables

### Required for Production
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Security
JWT_SECRET="your-256-bit-secret-key"
ALLOWED_ORIGINS="https://yourdomain.com"
ALLOWED_HOSTS="yourdomain.com,api.yourdomain.com"
FORCE_HTTPS="true"

# LLM APIs (for AI functionality)
GEMINI_API_KEY="your-gemini-key"
GROQ_API_KEY="your-groq-key"
```

### Optional but Recommended
```bash
# Monitoring
SENTRY_DSN="your-sentry-dsn"
LOG_LEVEL="INFO"

# Performance
DATABASE_POOL_SIZE="20"
REDIS_URL="redis://localhost:6379"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

## Security Best Practices

### 1. Network Security
- Use HTTPS everywhere with valid SSL certificates
- Implement rate limiting on API endpoints
- Set up Web Application Firewall (WAF)
- Configure proper CORS policies

### 2. Application Security
- Keep dependencies updated
- Use environment variables for sensitive data
- Implement input validation and sanitization
- Use prepared statements for database queries

### 3. Data Security
- Encrypt sensitive data at rest
- Use secure file upload handling
- Implement proper user authentication
- Regular security audits

## Monitoring and Maintenance

### Health Checks
Set up monitoring for:
- API endpoint availability
- Database connection status
- Response time metrics
- Error rate tracking

### Logging
- Configure centralized logging
- Set up log rotation
- Monitor error logs
- Track user activity

### Backup Strategy
- Regular database backups
- Document storage backups
- Configuration backups
- Test restore procedures

## Performance Optimization

### Database Optimization
- Create appropriate indexes
- Use connection pooling
- Optimize query performance
- Regular vacuum and analyze

### API Optimization
- Implement response caching
- Use compression middleware
- Optimize JSON serialization
- Implement pagination

### Frontend Optimization
- Enable gzip compression
- Optimize images and assets
- Implement service workers
- Use CDN for static files

## Troubleshooting

### Common Issues
1. **Database Connection Errors**
   - Check connection string format
   - Verify network connectivity
   - Check firewall rules

2. **LLM API Failures**
   - Verify API key validity
   - Check rate limits
   - Monitor quota usage

3. **File Upload Issues**
   - Check file size limits
   - Verify storage permissions
   - Check MIME type validation

### Debug Mode
For troubleshooting, temporarily enable debug mode:
```bash
DEBUG=true LOG_LEVEL=DEBUG python -m src.api.main
```

## Support and Maintenance

### Regular Tasks
- Monitor system health
- Update dependencies monthly
- Review security logs
- Backup verification
- Performance optimization

### Emergency Procedures
- Database recovery process
- API rollback procedures
- Incident response plan
- Communication protocols

## Contact and Support

For deployment support:
- Check application logs
- Review monitoring dashboards
- Contact development team
- Refer to troubleshooting guide