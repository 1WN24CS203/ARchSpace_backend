# ARchSpace Backend - Testing Guide

## 🧪 Testing Setup

### Backend Tests

The backend uses **Jest** for unit and integration testing.

#### Running Tests

```bash
cd React\ native/ARchSpace-Backend

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

#### Test Files

- `__tests__/health.test.js` - Health check endpoint tests
- `__tests__/auth.test.js` - Authentication route tests
- `__tests__/validation.test.js` - Password hashing and validation tests

#### Test Coverage

Current coverage targets:
- **Branches**: 70%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

#### What's Tested

✅ **Health Endpoints**
- GET / - Welcome message
- GET /health - Database connection status

✅ **Authentication**
- User registration with validation
- Password strength requirements
- Email format validation
- Company code verification
- Login with email/password
- OTP generation and verification
- Duplicate email detection

✅ **Security**
- Password hashing with salt
- Password verification
- Input validation

---

### Frontend Tests

The frontend uses **Jest** and **React Native Testing Library** for unit and component testing.

#### Running Tests

```bash
cd React\ native/ARchSpace

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

#### Test Files

- `__tests__/api.service.test.ts` - API service and authentication state
- `__tests__/form.validation.test.ts` - Form validation logic

#### What's Tested

✅ **Email Validation**
- Valid email formats
- Invalid email rejection

✅ **Password Validation**
- Strong password requirements
- Weak password rejection

✅ **API Error Handling**
- 401 Unauthorized
- 409 Conflict (duplicate email)
- 400 Bad Request
- Generic error handling

✅ **Authentication State**
- Login success state updates
- Logout functionality
- Profile updates

✅ **Form Validation**
- Registration form validation
- Login form validation
- Field requirement checks

---

## 🚀 Vercel Deployment & CI/CD

### Environment Variables (vercel.json)

The following environment variables are required:

```json
{
  "MONGO_URI": "mongodb+srv://user:password@cluster0.xxx.mongodb.net/",
  "EMAIL_SERVICE": "gmail",
  "EMAIL_USER": "your-email@gmail.com",
  "EMAIL_PASS": "your-app-password",
  "COMPANY_CODE": "ARCH2026"
}
```

### Deployment Process

1. **Local Testing**
   ```bash
   npm test
   npm run test:coverage
   ```

2. **Git Push**
   ```bash
   git add .
   git commit -m "feat: add tests"
   git push origin main
   ```

3. **Vercel Auto-Deploy**
   - Vercel automatically deploys on push to main branch
   - Ensure tests pass before pushing

### Build Output

The production build includes:
- Optimized Node.js server
- All environment variables
- Security middleware (CORS, JSON parsing)
- Health check endpoints

---

## 🔍 Test Execution Examples

### Example 1: Run All Tests

```bash
npm test

# Output:
# PASS  __tests__/health.test.js
# PASS  __tests__/auth.test.js
# PASS  __tests__/validation.test.js
#
# Test Suites: 3 passed, 3 total
# Tests:       42 passed, 42 total
# Snapshots:   0 total
# Time:        5.234 s
```

### Example 2: Run Specific Test File

```bash
npm test -- auth.test.js
```

### Example 3: Generate Coverage Report

```bash
npm run test:coverage

# Output:
# =============================== Coverage summary ===============================
# Statements   : 85% ( 127/149 )
# Branches     : 78% ( 45/58 )
# Functions    : 82% ( 23/28 )
# Lines        : 87% ( 132/152 )
# ================================================================================
```

---

## 📋 Continuous Integration Checklist

Before pushing to production:

- [ ] All tests pass locally
- [ ] Coverage meets thresholds
- [ ] No console errors or warnings
- [ ] Environment variables are set in Vercel
- [ ] MONGO_URI is valid MongoDB connection string
- [ ] Email credentials are correct
- [ ] Git commit message is descriptive

---

## 🐛 Common Testing Issues

### Issue: Tests Fail with MongoDB Connection Error

**Solution**: Ensure `MONGO_URI` is correctly set in environment. Tests use in-memory fallback for local development.

```bash
# For local testing without actual database:
npm test -- --runInBand
```

### Issue: Email Tests Fail

**Solution**: Email tests are mocked in local development. The actual Nodemailer is tested to ensure it doesn't throw errors.

### Issue: Port Already in Use

**Solution**: Kill the process or use a different port in environment.

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## 📊 Test Reports

Generated after running `npm run test:coverage`:

- Coverage report in `coverage/` directory
- Open `coverage/lcov-report/index.html` in browser to view detailed report

---

## 🔗 Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest API Testing](https://github.com/visionmedia/supertest)
- [React Native Testing Library](https://testing-library.com/docs/react-native-testing-library/intro)
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)

---

## ✅ Next Steps

1. Install dependencies:
   ```bash
   cd React\ native/ARchSpace-Backend && npm install
   cd ../ARchSpace && npm install
   ```

2. Run tests locally:
   ```bash
   npm test
   ```

3. Push to GitHub:
   ```bash
   git add .
   git commit -m "chore: add comprehensive test suite"
   git push origin main
   ```

4. Deploy to Vercel:
   ```bash
   vercel deploy
   ```

---

**Last Updated**: May 12, 2026  
**Test Framework Version**: Jest 29.7.0  
**Coverage Target**: 80%
